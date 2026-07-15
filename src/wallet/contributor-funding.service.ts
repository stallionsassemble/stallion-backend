import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Role } from '@prisma/client';
import * as StellarSDK from '@stellar/stellar-sdk';
import { PrismaService } from '../common/prisma/prisma.service';
import { PlatformSettingsService } from '../common/services/platform-settings.service';
import { StellarAccountService } from '../soroban/stellar-account.service';
import { StellarWalletService } from './stellar-wallet.service';
import { withFundingWalletLock } from './utils/funding-lock.util';
import { hasTrustline, setupTrustline } from './utils/trustline.util';
import { WalletSigningService } from './wallet-signing.service';

/**
 * Stellar reserve math (all in XLM).
 * Minimum account balance = (2 + numSubentries) * baseReserve, baseReserve = 0.5.
 */
const BASE_ACCOUNT_ENTRIES = 2;
const RESERVE_PER_ENTRY_XLM = 0.5;
/**
 * Headroom kept available on top of the reserve to pay a Soroban contract
 * invocation (inclusion fee + resource fees) with margin.
 */
const CONTRACT_CALL_FEE_HEADROOM_XLM = 1;
/**
 * Starting balance for a brand-new account: enough to activate it and cover the
 * immediate contract call. Kept intentionally small — just enough for the
 * account to exist on-chain and transact.
 */
const NEW_ACCOUNT_STARTING_BALANCE_XLM = 2.5;
/** Small extra buffer added to any top-up so we don't fund to the exact edge. */
const TOP_UP_BUFFER_XLM = 0.5;
/**
 * Time to wait after activating a brand-new account so the funding transaction
 * (submitted via Horizon) is visible to the Soroban RPC node before the
 * contract call reads the account.
 */
const POST_ACTIVATION_DELAY_MS = 3000;

export interface EnsureFundedResult {
  funded: boolean;
  fundingTxHash?: string;
  reason?: 'not-contributor' | 'sufficient-balance' | 'activated' | 'topped-up';
}

/**
 * Ensures a contributor's Stellar account has enough native XLM to perform an
 * action that touches the smart contract (apply to a bounty, update a
 * submission, etc.). This is the single funding entry point for the
 * contract-invocation boundary: call it immediately before any
 * contributor-signed contract call.
 *
 * Behaviour (per product decision — just-in-time, minimal top-up):
 *  - No-op for non-contributor roles (owners fund themselves).
 *  - If the account does not exist on-chain, activate it from the platform
 *    funding wallet with a minimal starting balance.
 *  - If it exists but lacks the reserve + fee headroom for the call, top up
 *    only the difference.
 *  - If funding is required but no funding wallet is configured, throw a clear
 *    error telling the user to deposit XLM (same UX as before auto-funding).
 */
@Injectable()
export class ContributorFundingService {
  private readonly logger = new Logger(ContributorFundingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly stellarAccount: StellarAccountService,
    private readonly stellarWallet: StellarWalletService,
    private readonly walletSigning: WalletSigningService,
    private readonly platformSettings: PlatformSettingsService,
  ) {}

  /**
   * Ensures a contributor's Stellar account has sufficient XLM to perform an
   * action that touches the smart contract (apply to a bounty, update a
   * submission, etc.). This is the single funding entry point for the
   * contract-invocation boundary: call it immediately before any
   * contributor-signed contract call.
   *
   * @param params - Wallet ID, public key, and optional additional subentries
   * @returns Funding result with status and transaction hash if funded
   */
  async ensureContributorFunded(params: {
    walletId: string;
    publicKey: string;
    /** Extra subentries the action will add (e.g. 1 for a new trustline). */
    additionalSubentries?: number;
  }): Promise<EnsureFundedResult> {
    const { walletId, publicKey, additionalSubentries = 0 } = params;

    // Only contributors are auto-funded.
    const user = await this.prisma.user.findFirst({
      where: { walletId },
      select: { role: true },
    });
    if (!user || user.role !== Role.CONTRIBUTOR) {
      return { funded: false, reason: 'not-contributor' };
    }

    const account = await this.loadAccountOrNull(publicKey);

    // Account does not exist yet → activate it.
    if (!account) {
      const startingBalance =
        NEW_ACCOUNT_STARTING_BALANCE_XLM +
        additionalSubentries * RESERVE_PER_ENTRY_XLM;
      const fundingTxHash = await this.fund(
        publicKey,
        startingBalance.toFixed(7),
        'activate account',
      );
      await this.delay(POST_ACTIVATION_DELAY_MS);
      return { funded: true, fundingTxHash, reason: 'activated' };
    }

    // Account exists → ensure it has reserve + fee headroom for the call.
    const nativeBalance = account.balances.find(
      (b) => b.asset_type === 'native',
    );
    const balance = nativeBalance ? parseFloat(nativeBalance.balance) : 0;
    const subentries = account.subentry_count ?? 0;

    const required =
      BASE_ACCOUNT_ENTRIES * RESERVE_PER_ENTRY_XLM +
      (subentries + additionalSubentries) * RESERVE_PER_ENTRY_XLM +
      CONTRACT_CALL_FEE_HEADROOM_XLM;

    if (balance >= required) {
      return { funded: false, reason: 'sufficient-balance' };
    }

    const topUp = required - balance + TOP_UP_BUFFER_XLM;
    const fundingTxHash = await this.fund(
      publicKey,
      topUp.toFixed(7),
      'top up for contract call',
    );
    return { funded: true, fundingTxHash, reason: 'topped-up' };
  }

  /**
   * Ensures a set of payout recipients' accounts can actually receive their
   * payout before a contract pays them out. Receiving a SAC-wrapped classic
   * asset (USDC, EURC, …) requires the destination account to be activated AND
   * to hold a trustline for that asset, otherwise the contract transfer fails;
   * a native XLM payout only needs the destination account to exist.
   *
   * Runs in three phases so many recipients can be prepared efficiently:
   *   1. Classify every recipient with parallel read-only lookups.
   *   2. Fund all recipients that need XLM in a SINGLE batched transaction from
   *      the funding wallet (one op per recipient), avoiding both sequence
   *      collisions and one-round-trip-per-recipient latency.
   *   3. Create the required trustlines concurrently — each is signed by the
   *      recipient's own wallet, so different source accounts don't collide.
   *
   * Not role-gated — payout recipients are prepared regardless of role.
   */
  async ensurePayoutRecipientsReady(
    recipients: Array<{
      walletId: string;
      publicKey: string;
      currency: string;
    }>,
  ): Promise<void> {
    if (recipients.length === 0) return;

    // Deduplicate by account: the same wallet can appear more than once (e.g. a
    // user winning multiple hackathon positions). Preparing an account once is
    // enough, and leaving dupes in would emit two createAccount ops for the same
    // destination in one tx (fails), or two concurrent trustline txs from the
    // same source (sequence collision). A payout batch is single-currency, so
    // collapsing on publicKey is safe.
    const uniqueRecipients = Array.from(
      new Map(recipients.map((r) => [r.publicKey, r])).values(),
    );

    const server = this.stellarAccount.getServer();
    const networkPassphrase = this.stellarAccount.getNetworkPassphrase();

    // Phase 1 — classify (parallel reads).
    const plans = await Promise.all(
      uniqueRecipients.map(async (r) => {
        const isXlm = r.currency.toUpperCase() === 'XLM';
        const account = await this.loadAccountOrNull(r.publicKey);

        // Brand-new account: create it. Token recipients also need a trustline.
        if (!account) {
          return {
            recipient: r,
            fundingOp: StellarSDK.Operation.createAccount({
              destination: r.publicKey,
              startingBalance: NEW_ACCOUNT_STARTING_BALANCE_XLM.toFixed(7),
            }),
            needsTrustline: !isXlm,
          };
        }

        // Existing account receiving native XLM is already able to receive.
        if (isXlm) {
          return { recipient: r, fundingOp: null, needsTrustline: false };
        }

        // Existing account, token payout: ready if the trustline already exists.
        const alreadyTrusts = await hasTrustline(
          r.publicKey,
          r.currency,
          networkPassphrase,
          server,
        );
        if (alreadyTrusts) {
          return { recipient: r, fundingOp: null, needsTrustline: false };
        }

        // Needs a new trustline (+1 subentry): top up XLM if the reserve falls
        // short of what's required to hold it.
        const nativeBalance = account.balances.find(
          (b) => b.asset_type === 'native',
        );
        const balance = nativeBalance ? parseFloat(nativeBalance.balance) : 0;
        const subentries = account.subentry_count ?? 0;
        const requiredToHoldTrustline =
          (BASE_ACCOUNT_ENTRIES + subentries + 1) * RESERVE_PER_ENTRY_XLM +
          TOP_UP_BUFFER_XLM;

        const fundingOp =
          balance < requiredToHoldTrustline
            ? StellarSDK.Operation.payment({
                destination: r.publicKey,
                asset: StellarSDK.Asset.native(),
                amount: (requiredToHoldTrustline - balance).toFixed(7),
              })
            : null;

        return { recipient: r, fundingOp, needsTrustline: true };
      }),
    );

    // Phase 2 — fund everyone who needs XLM in one transaction.
    const fundingOps = plans
      .map((p) => p.fundingOp)
      .filter((op): op is StellarSDK.xdr.Operation => op !== null);

    if (fundingOps.length > 0) {
      await this.submitFundingBatch(fundingOps);
      // Let freshly-created accounts settle before their trustline tx.
      await this.delay(POST_ACTIVATION_DELAY_MS);
    }

    // Phase 3 — create trustlines concurrently (each signed by its own wallet).
    await Promise.all(
      plans
        .filter((p) => p.needsTrustline)
        .map((p) =>
          setupTrustline(
            p.recipient.walletId,
            p.recipient.publicKey,
            p.recipient.currency,
            networkPassphrase,
            server,
            this.walletSigning,
          ),
        ),
    );
  }

  /**
   * Submits a single transaction from the platform funding wallet containing
   * one funding operation per recipient (createAccount / payment). Serialized
   * via the funding-wallet lock so it never collides with other funding txs.
   */
  private async submitFundingBatch(
    operations: StellarSDK.xdr.Operation[],
  ): Promise<string> {
    const fundingWalletId =
      await this.platformSettings.resolveFundingWalletId();

    if (!fundingWalletId) {
      this.logger.error(
        'Cannot fund payout recipients: no funding wallet configured',
      );
      throw new BadRequestException(
        'Payout recipients need XLM to receive funds, but no platform funding ' +
          'wallet is configured.',
      );
    }

    const server = this.stellarAccount.getServer();
    const networkPassphrase = this.stellarAccount.getNetworkPassphrase();

    return withFundingWalletLock(async () => {
      const fundingWallet =
        await this.stellarWallet.getWalletById(fundingWalletId);
      const fundingAccount = await server.loadAccount(fundingWallet.publicKey);

      const builder = new StellarSDK.TransactionBuilder(fundingAccount, {
        fee: StellarSDK.BASE_FEE,
        networkPassphrase,
      });
      for (const op of operations) {
        builder.addOperation(op);
      }
      const transaction = builder.setTimeout(30).build();

      const signedTx = await this.walletSigning.signTransaction(
        fundingWalletId,
        transaction,
      );
      const result = await server.submitTransaction(signedTx);
      this.logger.log(
        `Funded ${operations.length} payout recipient(s) in tx ${result.hash}`,
      );
      return result.hash;
    });
  }

  /** Loads an account, returning null if it does not exist on-chain (404). */
  private async loadAccountOrNull(
    publicKey: string,
  ): Promise<StellarSDK.Horizon.AccountResponse | null> {
    try {
      return await this.stellarAccount.getServer().loadAccount(publicKey);
    } catch (error: any) {
      if (error?.response?.status === 404) {
        return null;
      }
      // Unexpected Horizon error — surface it rather than silently skipping.
      throw error;
    }
  }

  /**
   * Sends `amount` XLM from the platform funding wallet to `targetPublicKey`.
   * Throws a user-facing error if no funding wallet is configured (so the
   * action fails with actionable guidance instead of a cryptic contract error).
   */
  private async fund(
    targetPublicKey: string,
    amount: string,
    context: string,
  ): Promise<string> {
    const fundingWalletId =
      await this.platformSettings.resolveFundingWalletId();

    if (!fundingWalletId) {
      this.logger.error(
        `Cannot ${context} for ${targetPublicKey}: no funding wallet configured`,
      );
      throw new BadRequestException(
        `Your wallet needs approximately ${amount} XLM to complete this action. ` +
          `Please deposit XLM to your wallet address: ${targetPublicKey}`,
      );
    }

    this.logger.log(
      `Funding ${targetPublicKey} with ${amount} XLM (${context})`,
    );

    const server = this.stellarAccount.getServer();
    const networkPassphrase = this.stellarAccount.getNetworkPassphrase();

    // Serialize the load-sequence → build → sign → submit cycle so concurrent
    // funding payments from the shared funding wallet don't collide on sequence.
    const result = await withFundingWalletLock(async () => {
      const fundingWallet =
        await this.stellarWallet.getWalletById(fundingWalletId);
      const fundingAccount = await server.loadAccount(fundingWallet.publicKey);

      const transaction = new StellarSDK.TransactionBuilder(fundingAccount, {
        fee: StellarSDK.BASE_FEE,
        networkPassphrase,
      })
        .addOperation(
          StellarSDK.Operation.payment({
            destination: targetPublicKey,
            asset: StellarSDK.Asset.native(),
            amount,
          }),
        )
        .setTimeout(30)
        .build();

      const signedTx = await this.walletSigning.signTransaction(
        fundingWalletId,
        transaction,
      );
      return server.submitTransaction(signedTx);
    });

    this.logger.log(
      `Funded ${targetPublicKey} with ${amount} XLM: ${result.hash}`,
    );
    return result.hash;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
