import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Horizon, Networks } from '@stellar/stellar-sdk';

/**
 * Stellar Account Service
 * -----------------------------------------------
 * Provides Stellar network utilities and account balance queries
 */
@Injectable()
export class StellarAccountService {
  private readonly logger = new Logger(StellarAccountService.name);
  private server: Horizon.Server;
  private readonly networkPassphrase: string;

  constructor(private configService: ConfigService) {
    const rpcUrl = this.configService.get<string>('SOROBAN_RPC_URL')!;
    const network = this.configService.get<string>('SOROBAN_NETWORK')!;

    this.server = new Horizon.Server(rpcUrl, {
      allowHttp: network === 'testnet',
    });

    this.networkPassphrase =
      this.configService.get<string>('SOROBAN_NETWORK_PASSPHRASE') ||
      (network === 'testnet' ? Networks.TESTNET : Networks.PUBLIC);
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
      const account = await this.server.loadAccount(publicKey);

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
      this.logger.error(
        `Failed to get account balance for ${publicKey}`,
        error,
      );
      return '0';
    }
  }
}
