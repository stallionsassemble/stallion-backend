import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  Asset,
  hash,
  Horizon,
  Keypair,
  Networks,
  Operation,
  Transaction,
  TransactionBuilder,
  xdr,
} from '@stellar/stellar-sdk';
import { EnvConfig } from 'src/config/env.config';
import { StellarWalletService } from './stellar-wallet.service';

@Injectable()
export class WalletSigningService {
  private readonly logger = new Logger(WalletSigningService.name);
  private readonly server: Horizon.Server;
  private readonly networkPassphrase: string;

  constructor(
    private readonly stellarWallet: StellarWalletService,
    private readonly config: ConfigService,
  ) {
    const horizonUrl = this.config.getOrThrow<string>(
      EnvConfig.SOROBAN_HORIZON_URL,
    );
    const network = this.config.getOrThrow<string>(EnvConfig.SOROBAN_NETWORK);

    this.server = new Horizon.Server(horizonUrl, {
      allowHttp: network === 'testnet',
    });

    this.networkPassphrase =
      this.config.get<string>(EnvConfig.SOROBAN_NETWORK_PASSPHRASE) ||
      (network === 'testnet' ? Networks.TESTNET : Networks.PUBLIC);
  }

  async signAndSubmitPayment(
    walletId: string,
    destination: string,
    amount: string,
    asset: Asset = Asset.native(),
    decimals: number = 7,
  ): Promise<string> {
    let keypair: Keypair | null = null;

    try {
      keypair = await this.stellarWallet.getDecryptedKeypair(walletId);

      const account = await this.server.loadAccount(keypair.publicKey());

      let txBuilder = new TransactionBuilder(account, {
        fee: '100000',
        networkPassphrase: this.networkPassphrase,
      });

      txBuilder = txBuilder.addOperation(
        Operation.payment({
          destination,
          asset,
          amount: (parseInt(amount) / Math.pow(10, decimals)).toString(),
        }),
      );

      const tx = txBuilder.setTimeout(30).build();

      tx.sign(keypair);

      const result = await this.server.submitTransaction(tx);

      this.logger.log(
        `Transaction signed and submitted: ${result.hash} from wallet ${walletId}`,
      );

      return result.hash;
    } catch (error) {
      this.logger.error(
        `Failed to sign and submit payment for wallet ${walletId}: ${error.message}`,
        error.stack,
      );
      throw error;
    } finally {
      if (keypair) {
        keypair = null;
      }
    }
  }

  async signTransaction(
    walletId: string,
    transaction: Transaction,
  ): Promise<Transaction> {
    let keypair: Keypair | null = null;

    try {
      keypair = await this.stellarWallet.getDecryptedKeypair(walletId);

      // Sign Soroban auth entries if present
      for (const op of transaction.operations) {
        if (op.type === 'invokeHostFunction' && (op as any).auth) {
          const authEntries = (op as any).auth;

          for (let i = 0; i < authEntries.length; i++) {
            // Use SDK helper to sign auth entries
            authEntries[i] = this.signAuthEntry(
              authEntries[i],
              keypair,
              transaction.networkPassphrase,
            );
          }
        }
      }

      // Sign the transaction envelope
      transaction.sign(keypair);

      this.logger.log(`Transaction signed for wallet ${walletId}`);

      return transaction;
    } catch (error) {
      this.logger.error(
        `Failed to sign transaction for wallet ${walletId}: ${error.message}`,
        error.stack,
      );
      throw error;
    } finally {
      if (keypair) {
        keypair = null;
      }
    }
  }

  private signAuthEntry(
    entry: xdr.SorobanAuthorizationEntry,
    keypair: Keypair,
    networkPassphrase: string,
  ): xdr.SorobanAuthorizationEntry {
    const credentials = entry.credentials();

    if (credentials.switch().name !== 'sorobanCredentialsAddress') {
      return entry;
    }

    const addressCredentials = credentials.address();
    const address = addressCredentials.address();

    // Check if this entry is for our keypair
    const needsSigning =
      address.switch().name === 'scAddressTypeAccount' &&
      address.accountId().ed25519().toString('hex') ===
        keypair.rawPublicKey().toString('hex');

    if (!needsSigning) {
      return entry;
    }

    // Create signature preimage
    const preimage = xdr.HashIdPreimage.envelopeTypeSorobanAuthorization(
      new xdr.HashIdPreimageSorobanAuthorization({
        networkId: hash(Buffer.from(networkPassphrase, 'utf-8')),
        nonce: addressCredentials.nonce(),
        signatureExpirationLedger:
          addressCredentials.signatureExpirationLedger(),
        invocation: entry.rootInvocation(),
      }),
    );

    // Sign the payload
    const payload = hash(preimage.toXDR());
    const signature = keypair.sign(payload);

    // Create signed credentials
    const signedCredentials = new xdr.SorobanAddressCredentials({
      address: address,
      nonce: addressCredentials.nonce(),
      signatureExpirationLedger: addressCredentials.signatureExpirationLedger(),
      signature: xdr.ScVal.scvVec([
        xdr.ScVal.scvMap([
          new xdr.ScMapEntry({
            key: xdr.ScVal.scvSymbol('public_key'),
            val: xdr.ScVal.scvBytes(keypair.rawPublicKey()),
          }),
          new xdr.ScMapEntry({
            key: xdr.ScVal.scvSymbol('signature'),
            val: xdr.ScVal.scvBytes(signature),
          }),
        ]),
      ]),
    });

    // Return new auth entry with signed credentials
    return new xdr.SorobanAuthorizationEntry({
      credentials:
        xdr.SorobanCredentials.sorobanCredentialsAddress(signedCredentials),
      rootInvocation: entry.rootInvocation(),
    });
  }

  async getAccountBalance(publicKey: string): Promise<string> {
    try {
      const account = await this.server.loadAccount(publicKey);

      const bal = account.balances.find((b) => b.asset_type === 'native');

      if (!bal) return '0';

      return BigInt(Math.floor(parseFloat(bal.balance) * 10000000)).toString();
    } catch (error) {
      this.logger.error(
        `Failed to get account balance for ${publicKey}: ${error.message}`,
      );
      return '0';
    }
  }

  async checkAccountExists(publicKey: string): Promise<boolean> {
    try {
      await this.server.loadAccount(publicKey);
      return true;
    } catch {
      return false;
    }
  }
}
