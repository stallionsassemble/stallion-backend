import { BadRequestException, Logger } from '@nestjs/common';
import * as StellarSDK from '@stellar/stellar-sdk';
import { getCurrency } from '../../bounties/utils/supported-currencies';

const logger = new Logger('TrustlineUtil');

/**
 * Check if an account has a trustline for a specific currency
 */
export async function hasTrustline(
  publicKey: string,
  currencyCode: string,
  networkPassphrase: string,
  server: StellarSDK.Horizon.Server,
): Promise<boolean> {
  try {
    // XLM doesn't require a trustline
    if (currencyCode.toUpperCase() === 'XLM') {
      return true;
    }

    const account = await server.loadAccount(publicKey);
    const currency = getCurrency(currencyCode, networkPassphrase);
    if (!currency) {
      throw new BadRequestException(`Unsupported currency: ${currencyCode}`);
    }

    // For Soroban tokens, we check if there's a balance entry
    // The presence of a balance entry indicates a trustline exists
    const hasTrust = account.balances.some(
      (balance: any) =>
        balance.asset_code?.toUpperCase() === currencyCode.toUpperCase(),
    );

    return hasTrust;
  } catch (error) {
    logger.error(
      `Failed to check trustline for ${publicKey} and ${currencyCode}`,
      error,
    );
    return false;
  }
}

/**
 * Setup a trustline for a specific currency
 * This creates a change trust operation that establishes the trustline
 */
export async function setupTrustline(
  walletId: string,
  publicKey: string,
  currencyCode: string,
  networkPassphrase: string,
  server: StellarSDK.Horizon.Server,
  walletSigningService: any,
): Promise<string> {
  try {
    // XLM doesn't require a trustline
    if (currencyCode.toUpperCase() === 'XLM') {
      throw new BadRequestException('XLM does not require a trustline');
    }

    // Get currency details
    const currency = getCurrency(currencyCode, networkPassphrase);

    // Check if trustline already exists
    const exists = await hasTrustline(
      publicKey,
      currencyCode,
      networkPassphrase,
      server,
    );

    if (exists) {
      logger.log(
        `Trustline already exists for ${publicKey} and ${currencyCode}`,
      );
      return 'exists';
    }

    // Load the account
    const account = await server.loadAccount(publicKey);

    // For Soroban tokens, we need to create a trustline using the token contract
    // Create an asset representing the Soroban token
    const asset = new StellarSDK.Asset(
      currencyCode,
      currency.tokenAddress.substring(0, 56), // Stellar classic issuer format
    );

    // Build change trust transaction
    const transaction = new StellarSDK.TransactionBuilder(account, {
      fee: StellarSDK.BASE_FEE,
      networkPassphrase,
    })
      .addOperation(
        StellarSDK.Operation.changeTrust({
          asset: asset,
          limit: '922337203685.4775807', // Max limit
        }),
      )
      .setTimeout(30)
      .build();

    // Sign the transaction with the user's wallet
    const signedTx = await walletSigningService.signTransaction(
      walletId,
      transaction,
    );

    // Submit the transaction
    const result = await server.submitTransaction(signedTx);

    logger.log(
      `Trustline established for ${publicKey} and ${currencyCode}: ${result.hash}`,
    );

    return result.hash;
  } catch (error) {
    logger.error(
      `Failed to setup trustline for ${publicKey} and ${currencyCode}`,
      error,
    );
    throw new BadRequestException(
      `Failed to setup trustline: ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
  }
}

/**
 * Check if account is activated and has sufficient reserves
 * Stellar accounts need minimum balance (base reserve) + additional reserves for trustlines
 * Base reserve: 1 XLM, Each trustline: 0.5 XLM
 */
async function checkAccountReserves(
  publicKey: string,
  server: StellarSDK.Horizon.Server,
): Promise<{
  activated: boolean;
  needsFunding: boolean;
  requiredAmount?: string;
}> {
  try {
    const account = await server.loadAccount(publicKey);

    // Get native XLM balance
    const nativeBalance = account.balances.find(
      (b: any) => b.asset_type === 'native',
    );

    if (!nativeBalance) {
      return { activated: true, needsFunding: true, requiredAmount: '2.5' };
    }

    const balance = parseFloat(nativeBalance.balance);
    const numSubentries = account.subentry_count || 0;

    // Calculate required reserves
    // Base reserve (2 XLM) + (numSubentries * 0.5 XLM) + buffer for new trustline (0.5 XLM) + tx fees (0.1 XLM)
    const requiredReserve = 2 + numSubentries * 0.5 + 0.5 + 0.1;

    if (balance < requiredReserve) {
      const deficit = requiredReserve - balance;
      return {
        activated: true,
        needsFunding: true,
        requiredAmount: (deficit + 0.5).toFixed(1), // Add buffer
      };
    }

    return { activated: true, needsFunding: false };
  } catch (error: any) {
    // Account not found - needs activation
    if (error?.response?.status === 404) {
      return {
        activated: false,
        needsFunding: true,
        requiredAmount: '2.5', // Minimum to activate + trustline + buffer
      };
    }

    logger.error(`Failed to check account reserves for ${publicKey}`, error);
    throw error;
  }
}

/**
 * Fund an account with XLM from a funding source
 * This would typically be called from a service that has access to a funding wallet
 */
async function fundAccount(
  targetPublicKey: string,
  amount: string,
  server: StellarSDK.Horizon.Server,
  walletSigningService: any,
  fundingWalletId: string,
  networkPassphrase: string,
): Promise<string> {
  try {
    logger.log(`Funding account ${targetPublicKey} with ${amount} XLM`);

    // Load funding account
    const fundingAccount = await server.loadAccount(
      await walletSigningService.getPublicKey(fundingWalletId),
    );

    // Build payment transaction
    const transaction = new StellarSDK.TransactionBuilder(fundingAccount, {
      fee: StellarSDK.BASE_FEE,
      networkPassphrase,
    })
      .addOperation(
        StellarSDK.Operation.payment({
          destination: targetPublicKey,
          asset: StellarSDK.Asset.native(),
          amount: amount,
        }),
      )
      .setTimeout(30)
      .build();

    // Sign and submit
    const signedTx = await walletSigningService.signTransaction(
      fundingWalletId,
      transaction,
    );
    const result = await server.submitTransaction(signedTx);

    logger.log(`Account funded successfully: ${result.hash}`);
    return result.hash;
  } catch (error) {
    logger.error(`Failed to fund account ${targetPublicKey}`, error);
    throw new BadRequestException(
      `Failed to fund account: ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
  }
}

/**
 * Ensure a user has a trustline for a specific currency
 * Checks if trustline exists, and creates it if it doesn't
 * Also checks account activation and reserves, funding if necessary
 */
export async function ensureTrustline(
  walletId: string,
  publicKey: string,
  currencyCode: string,
  networkPassphrase: string,
  server: StellarSDK.Horizon.Server,
  walletSigningService: any,
  fundingWalletId?: string,
): Promise<{
  exists: boolean;
  txHash?: string;
  funded?: boolean;
  fundingTxHash?: string;
}> {
  // Check if trustline already exists
  const exists = await hasTrustline(
    publicKey,
    currencyCode,
    networkPassphrase,
    server,
  );

  if (exists) {
    return { exists: true };
  }

  // Check account reserves before creating trustline
  const reserveCheck = await checkAccountReserves(publicKey, server);

  let fundingTxHash: string | undefined;
  if (reserveCheck.needsFunding) {
    if (!fundingWalletId) {
      throw new BadRequestException(
        `Account ${publicKey} needs ${reserveCheck.requiredAmount} XLM to create trustline. ` +
          `Please fund the account first or provide a funding wallet.`,
      );
    }

    logger.log(
      `Account needs funding: ${reserveCheck.requiredAmount} XLM required`,
    );

    // Fund the account
    fundingTxHash = await fundAccount(
      publicKey,
      reserveCheck.requiredAmount!,
      server,
      walletSigningService,
      fundingWalletId,
      networkPassphrase,
    );

    // Wait a moment for the funding transaction to be processed
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  // Now create the trustline
  const txHash = await setupTrustline(
    walletId,
    publicKey,
    currencyCode,
    networkPassphrase,
    server,
    walletSigningService,
  );

  return {
    exists: false,
    txHash,
    funded: !!fundingTxHash,
    fundingTxHash,
  };
}
