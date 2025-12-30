import { BadRequestException } from '@nestjs/common';
import * as StellarSDK from '@stellar/stellar-sdk';
import { getCurrency, getTokenAddress } from './supported-currencies';

/**
 * Estimated transaction fee in stroops (0.00001 XLM = 100 stroops per operation)
 * We estimate 5 operations for bounty creation
 */
const ESTIMATED_TX_FEE = 500; // stroops

/**
 * Minimum XLM reserve to keep in account (1 XLM)
 */
const MIN_XLM_RESERVE = 10000000; // stroops (1 XLM)

/**
 * Contract fee percentage (e.g., 5% = 0.05)
 */
const CONTRACT_FEE_PERCENTAGE = 0.05;

/**
 * Validates that a wallet is ready to create a bounty
 * Checks:
 * 1. Account exists and is activated on Stellar network
 * 2. Has trustline for the specified token
 * 3. Has sufficient balance to cover reward + fees
 *
 * @param publicKey - Stellar public key of the wallet
 * @param rewardAmount - Reward amount in token units
 * @param currencyCode - Currency code (e.g., 'USDC', 'XLM')
 * @param rpcUrl - Stellar RPC URL for contract simulation
 * @param horizonUrl - Stellar Horizon URL for account data
 * @param networkPassphrase - Stellar network passphrase (defaults to TESTNET)
 * @throws BadRequestException if any validation fails
 */
export async function validateWalletForBountyCreation(
  publicKey: string,
  rewardAmount: number,
  currencyCode: string,
  rpcUrl: string,
  horizonUrl: string,
  networkPassphrase: string = StellarSDK.Networks.TESTNET,
): Promise<void> {
  const rpcServer = new StellarSDK.rpc.Server(rpcUrl);
  // Use Horizon server for account data
  const horizonServer = new StellarSDK.Horizon.Server(horizonUrl, {
    allowHttp: true,
  });

  try {
    // 1. Check if account exists and is activated
    let accountResponse: StellarSDK.Horizon.AccountResponse;
    try {
      accountResponse = await horizonServer.loadAccount(publicKey);
    } catch {
      throw new BadRequestException(
        'Wallet is not activated on the Stellar network. Please activate your wallet by funding it with XLM.',
      );
    }

    // Get token address and currency details
    const tokenAddress = getTokenAddress(currencyCode, networkPassphrase);
    const currency = getCurrency(currencyCode, networkPassphrase);

    // 2. Check if trustline exists and get token balance
    let tokenBalance = '0';

    if (currencyCode.toUpperCase() === 'XLM') {
      // For native XLM, use the native balance
      const nativeBalance = accountResponse.balances.find(
        (b: any) => b.asset_type === 'native',
      );
      if (!nativeBalance) {
        throw new BadRequestException(
          'Unable to retrieve XLM balance from wallet.',
        );
      }
      tokenBalance = nativeBalance.balance;
    } else {
      // For Soroban tokens, query the token contract for balance
      try {
        // Build contract call to get balance
        const contract = new StellarSDK.Contract(tokenAddress);
        const tx = new StellarSDK.TransactionBuilder(
          new StellarSDK.Account(publicKey, '0'),
          {
            fee: StellarSDK.BASE_FEE,
            networkPassphrase,
          },
        )
          .addOperation(
            contract.call(
              'balance',
              StellarSDK.nativeToScVal(publicKey, { type: 'address' }),
            ),
          )
          .setTimeout(30)
          .build();

        // Simulate the transaction to get balance using RPC server
        const simulation = await rpcServer.simulateTransaction(tx);

        if (StellarSDK.rpc.Api.isSimulationSuccess(simulation)) {
          if (!simulation.result) {
            throw new BadRequestException(
              `Unable to query balance for ${currencyCode}. The token contract may not be accessible.`,
            );
          }

          // Extract balance from simulation result
          const balanceScVal = simulation.result.retval;
          const balance = StellarSDK.scValToNative(balanceScVal);

          // Balance is returned in smallest unit (with decimals)
          // Convert to standard unit by dividing by 10^decimals
          const balanceInSmallestUnit = BigInt(balance.toString());
          const divisor = BigInt(10 ** currency.decimals);
          const balanceInStandardUnit =
            Number(balanceInSmallestUnit) / Number(divisor);
          tokenBalance = balanceInStandardUnit.toString();

          console.log(
            `[Wallet Validator] ${currencyCode} balance from contract:`,
            balance.toString(),
          );
          console.log(
            `[Wallet Validator] ${currencyCode} decimals:`,
            currency.decimals,
          );
          console.log(
            `[Wallet Validator] ${currencyCode} balance in standard unit:`,
            tokenBalance,
          );
        } else {
          // Simulation failed - likely no trustline or token not found
          throw new BadRequestException(
            `No balance found for ${currencyCode}. Please ensure you have added this token to your wallet and have a trustline established.`,
          );
        }
      } catch (error) {
        if (error instanceof BadRequestException) {
          throw error;
        }
        throw new BadRequestException(
          `Failed to verify ${currencyCode} balance: ${error instanceof Error ? error.message : 'Unknown error'}. Please ensure the token contract is valid and you have a trustline.`,
        );
      }
    }

    // 3. Calculate required balance
    const contractFee = rewardAmount * CONTRACT_FEE_PERCENTAGE;
    const totalRequired = rewardAmount + contractFee;

    // Convert token balance to number for comparison
    const availableBalance = parseFloat(tokenBalance);

    console.log(`[Wallet Validator] Reward amount:`, rewardAmount);
    console.log(
      `[Wallet Validator] Contract fee (${CONTRACT_FEE_PERCENTAGE * 100}%):`,
      contractFee,
    );
    console.log(`[Wallet Validator] Total required:`, totalRequired);
    console.log(`[Wallet Validator] Available balance:`, availableBalance);

    if (availableBalance < totalRequired) {
      throw new BadRequestException(
        `Insufficient ${currencyCode} balance. Required: ${totalRequired.toFixed(7)} (Reward: ${rewardAmount}, Contract Fee: ${contractFee.toFixed(7)}). Available: ${availableBalance.toFixed(7)}`,
      );
    }

    // 4. Check XLM balance for transaction fees (if token is not XLM)
    if (currencyCode.toUpperCase() !== 'XLM') {
      const xlmBalance = accountResponse.balances.find(
        (b) => b.asset_type === 'native',
      );
      if (!xlmBalance) {
        throw new BadRequestException(
          'Unable to retrieve XLM balance for transaction fees.',
        );
      }

      const xlmAvailable = parseFloat(xlmBalance.balance) * 10000000; // Convert to stroops
      const minXlmRequired = ESTIMATED_TX_FEE + 10000000; // Fee + 1 XLM reserve

      if (xlmAvailable < minXlmRequired) {
        throw new BadRequestException(
          `Insufficient XLM for transaction fees. Required: ${(minXlmRequired / 10000000).toFixed(7)} XLM. Available: ${(xlmAvailable / 10000000).toFixed(7)} XLM`,
        );
      }
    } else {
      // If paying in XLM, ensure enough for both reward and tx fees
      const xlmAvailable = parseFloat(tokenBalance) * 10000000; // Convert to stroops
      const totalRequiredStroops =
        totalRequired * 10000000 + ESTIMATED_TX_FEE + 10000000; // Reward + fees + reserve

      if (xlmAvailable < totalRequiredStroops) {
        throw new BadRequestException(
          `Insufficient XLM. Required: ${(totalRequiredStroops / 10000000).toFixed(7)} XLM (includes reward, fees, and reserve). Available: ${(xlmAvailable / 10000000).toFixed(7)} XLM`,
        );
      }
    }
  } catch (error) {
    if (error instanceof BadRequestException) {
      throw error;
    }
    throw new BadRequestException(
      `Failed to validate wallet: ${error.message || 'Unknown error'}`,
    );
  }
}

/**
 * Validates that a wallet is ready for smart contract transactions
 * Checks:
 * 1. Account exists and is activated on Stellar network
 * 2. Has sufficient XLM balance for transaction fees
 *
 * @param publicKey - Stellar public key of the wallet
 * @param horizonUrl - Stellar Horizon URL for account data
 * @throws BadRequestException if any validation fails
 */
export async function validateWalletForTransaction(
  publicKey: string,
  horizonUrl: string,
): Promise<void> {
  const horizonServer = new StellarSDK.Horizon.Server(horizonUrl, {
    allowHttp: true,
  });

  try {
    // Check if account exists and is activated
    let accountResponse: StellarSDK.Horizon.AccountResponse;
    try {
      accountResponse = await horizonServer.loadAccount(publicKey);
    } catch {
      throw new BadRequestException(
        'Wallet is not activated on the Stellar network. Please activate your wallet by funding it with XLM.',
      );
    }

    // Check XLM balance for transaction fees
    const xlmBalance = accountResponse.balances.find(
      (b) => b.asset_type === 'native',
    );

    if (!xlmBalance) {
      throw new BadRequestException(
        'Unable to retrieve XLM balance for transaction fees.',
      );
    }

    const xlmAvailable = parseFloat(xlmBalance.balance) * 10000000; // Convert to stroops
    const minXlmRequired = ESTIMATED_TX_FEE + MIN_XLM_RESERVE;

    if (xlmAvailable < minXlmRequired) {
      throw new BadRequestException(
        `Insufficient XLM for transaction fees. Required: ${(minXlmRequired / 10000000).toFixed(7)} XLM. Available: ${(xlmAvailable / 10000000).toFixed(7)} XLM`,
      );
    }
  } catch (error) {
    if (error instanceof BadRequestException) {
      throw error;
    }
    throw new BadRequestException(
      `Failed to validate wallet: ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
  }
}
