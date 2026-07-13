import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Horizon, Networks } from '@stellar/stellar-sdk';
import { EnvConfig } from 'src/config/env.config';

/**
 * Stellar Account Service
 * -----------------------------------------------
 * Provides Stellar network utilities and account balance queries
 */
@Injectable()
export class StellarAccountService {
  private readonly logger = new Logger(StellarAccountService.name);
  private server: Horizon.Server;
  private readonly horizonUrl: string;
  private readonly allowHttp: boolean;
  private readonly networkPassphrase: string;

  constructor(private configService: ConfigService) {
    this.horizonUrl = this.configService.getOrThrow<string>(
      EnvConfig.SOROBAN_HORIZON_URL,
    );
    const network = this.configService.getOrThrow<string>(
      EnvConfig.SOROBAN_NETWORK,
    );
    this.allowHttp = network === 'testnet';

    this.server = this.createServer();

    this.networkPassphrase =
      this.configService.get<string>(EnvConfig.SOROBAN_NETWORK_PASSPHRASE) ||
      (network === 'testnet' ? Networks.TESTNET : Networks.PUBLIC);
  }

  private createServer(): Horizon.Server {
    return new Horizon.Server(this.horizonUrl, { allowHttp: this.allowHttp });
  }

  getServer(): Horizon.Server {
    return this.server;
  }

  getNetworkPassphrase(): string {
    return this.networkPassphrase;
  }

  /**
   * Get account balance (returns stroops)
   */
  async getAccountBalance(publicKey: string): Promise<string> {
    try {
      this.logger.log(`Fetching balance for public key: ${publicKey}`);
      const account = await this.loadWithRetry(publicKey);

      const bal = account.balances.find((b) => b.asset_type === 'native');

      if (!bal) {
        this.logger.warn(`No native balance found for ${publicKey}`);
        return '0';
      }

      const balance = BigInt(
        Math.floor(parseFloat(bal.balance) * 10000000),
      ).toString();
      this.logger.log(`Balance for ${publicKey}: ${balance} stroops`);
      return balance;
    } catch (error) {
      // A confirmed-absent account has no balance yet — that's not an error.
      if (error instanceof AccountNotFoundError) {
        return '0';
      }
      // A transient Horizon failure must NOT be masked as a zero balance,
      // otherwise downstream logic sees a funded account as empty.
      this.logger.error(
        `Failed to get account balance for ${publicKey}`,
        error,
      );
      throw error;
    }
  }

  /**
   * Get all account balances for all assets
   */
  async getAllAccountBalances(publicKey: string): Promise<
    Array<{
      asset_type: string;
      asset_code?: string;
      asset_issuer?: string;
      balance: string;
    }>
  > {
    try {
      this.logger.log(`Fetching all balances for public key: ${publicKey}`);
      const account = await this.loadWithRetry(publicKey);

      return account.balances.map((bal) => {
        const baseBalance = {
          asset_type: bal.asset_type,
          balance: bal.balance,
        };

        if (
          bal.asset_type === 'credit_alphanum4' ||
          bal.asset_type === 'credit_alphanum12'
        ) {
          return {
            ...baseBalance,
            asset_code: bal.asset_code,
            asset_issuer: bal.asset_issuer,
          };
        }

        return baseBalance;
      });
    } catch (error) {
      // Confirmed-absent account legitimately has no balances.
      if (error instanceof AccountNotFoundError) {
        return [];
      }
      // Surface transient Horizon failures instead of reporting an empty
      // (falsely zero) balance set to callers.
      this.logger.error(
        `Failed to get account balances for ${publicKey}`,
        error,
      );
      throw error;
    }
  }

  /**
   * Load an account, retrying across FRESH connections on failure.
   *
   * A degraded Horizon node returns 404 for accounts that actually exist, so
   * we cannot trust a single 404. Each attempt uses a new server (and, with
   * keep-alive disabled, a new socket that can be re-load-balanced to a
   * healthy node). Only if every attempt still 404s do we conclude the
   * account genuinely does not exist and throw AccountNotFoundError.
   * Any other failure is treated as transient and thrown as-is.
   */
  private async loadWithRetry(pk: string, retries = 4) {
    let lastError: unknown;

    for (let i = 0; i < retries; i++) {
      try {
        // Fresh server per attempt so a poisoned connection isn't reused.
        return await this.createServer().loadAccount(pk);
      } catch (e) {
        lastError = e;
        this.logger.warn(
          `loadAccount attempt ${i + 1}/${retries} failed for ${pk}: ${
            e instanceof Error ? e.message : 'unknown error'
          }`,
        );
        if (i < retries - 1) {
          // Exponential backoff: 500ms, 1s, 2s, ...
          await new Promise((r) => setTimeout(r, 500 * 2 ** i));
        }
      }
    }

    if (isNotFoundError(lastError)) {
      // Every fresh-connection attempt returned 404 → account really is absent.
      throw new AccountNotFoundError(pk);
    }

    this.logger.error(
      `Failed to load account ${pk} after ${retries} attempts`,
      lastError,
    );
    throw lastError instanceof Error
      ? lastError
      : new Error(`Failed to load account ${pk}`);
  }
}

/** Thrown when an account is confirmed absent after fresh-connection retries. */
export class AccountNotFoundError extends Error {
  constructor(publicKey: string) {
    super(`Account ${publicKey} not found on Horizon`);
    this.name = 'AccountNotFoundError';
  }
}

/** Detect a genuine Horizon 404 (account not found) response. */
function isNotFoundError(error: unknown): boolean {
  const status = (error as { response?: { status?: number } })?.response
    ?.status;
  return status === 404 || (error as { name?: string })?.name === 'NotFoundError';
}
