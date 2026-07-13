import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as StellarSDK from '@stellar/stellar-sdk';
import { Client as SorobanClient } from 'src/soroban/contract-bindings';
import { ContractErrorHandler } from 'src/soroban/contract-error-handler';
import { buildSorobanContractOptions } from 'src/soroban/soroban-rpc.util';
import { EnvConfig } from '../../config/env.config';
import { WalletSigningService } from '../../wallet/wallet-signing.service';

@Injectable()
export class HackathonContractService {
  private readonly logger = new Logger(HackathonContractService.name);
  private readonly contractId: string;
  private readonly networkPassphrase: string;
  readonly sorobanClient: SorobanClient;

  constructor(
    private configService: ConfigService,
    private walletSigning: WalletSigningService,
  ) {
    this.contractId = this.configService.getOrThrow<string>(
      EnvConfig.SOROBAN_CONTRACT_ID,
    );
    this.networkPassphrase =
      this.configService.get<string>(EnvConfig.SOROBAN_NETWORK_PASSPHRASE) ||
      'Test SDF Network ; September 2015';

    const rpcUrl = this.configService.getOrThrow<string>(
      EnvConfig.SOROBAN_RPC_URL,
    );
    // Pin the submit/poll flow to one RPC node and bid a surge-proof fee.
    this.sorobanClient = new SorobanClient(
      buildSorobanContractOptions({
        contractId: this.contractId,
        networkPassphrase: this.networkPassphrase,
        rpcUrl,
      }),
    );

    this.logger.log('HackathonContractService initialized');
  }

  async createHackathon(params: {
    adminPublicKey: string;
    adminWalletId: string;
    token: string;
    totalBudget: string;
    prizePool: Array<{ position: number; amount: string }>;
    deadline: Date;
  }): Promise<{ contractHackathonId: bigint; txHash: string }> {
    this.logger.log(`Creating hackathon for admin ${params.adminPublicKey}`);

    const totalBudget = BigInt(params.totalBudget);
    const prizePool = params.prizePool.map((p) => {
      return { position: p.position, amount: BigInt(p.amount) };
    });

    this.sorobanClient.options.publicKey = params.adminPublicKey;

    const result = await ContractErrorHandler.wrapContractCall(async () => {
      const tx = await this.sorobanClient.create_hackathon({
        owner: params.adminPublicKey,
        token: params.token,
        total_budget: totalBudget,
        prize_pool: prizePool,
        deadline: BigInt(Math.floor(params.deadline.getTime() / 1000)),
      });

      return await tx.signAndSend({
        signTransaction: async (transactionXdr) => {
          const transaction = StellarSDK.TransactionBuilder.fromXDR(
            transactionXdr,
            this.networkPassphrase,
          ) as StellarSDK.Transaction;

          const signedTx = await this.walletSigning.signTransaction(
            params.adminWalletId,
            transaction,
          );

          return {
            signedTxXdr: signedTx.toXDR(),
            signerAddress: params.adminPublicKey,
          };
        },
      });
    }, 'create hackathon');

    if (!result.result.isOk()) {
      const error = result.result.unwrapErr();
      ContractErrorHandler.handleContractError(error, 'create hackathon');
    }

    if (!result.getTransactionResponse) {
      throw new BadRequestException('Transaction response not available');
    }

    return {
      contractHackathonId: BigInt(result.result.unwrap().toString()),
      txHash: result.getTransactionResponse.txHash,
    };
  }

  async updateHackathon(params: {
    adminPublicKey: string;
    adminWalletId: string;
    contractHackathonId: bigint;
    newDeadline?: Date;
    newPrizePool?: Array<{ position: number; amount: string }>;
  }): Promise<{ txHash: string }> {
    this.logger.log(`Updating hackathon ${params.contractHackathonId}`);

    this.sorobanClient.options.publicKey = params.adminPublicKey;

    const result = await ContractErrorHandler.wrapContractCall(async () => {
      let deadlineArg: bigint | undefined;
      if (params.newDeadline) {
        deadlineArg = BigInt(Math.floor(params.newDeadline.getTime() / 1000));
      }

      let prizePoolArg: Array<{ position: number; amount: bigint }> | undefined;
      if (params.newPrizePool) {
        prizePoolArg = params.newPrizePool.map((p) => ({
          position: p.position,
          amount: BigInt(p.amount),
        }));
      }

      const tx = await this.sorobanClient.update_hackathon({
        owner: params.adminPublicKey,
        hackathon_id: params.contractHackathonId,
        new_deadline: deadlineArg,
        new_prize_pool: prizePoolArg,
      });

      return await tx.signAndSend({
        signTransaction: async (transactionXdr) => {
          const transaction = StellarSDK.TransactionBuilder.fromXDR(
            transactionXdr,
            this.networkPassphrase,
          ) as StellarSDK.Transaction;

          const signedTx = await this.walletSigning.signTransaction(
            params.adminWalletId,
            transaction,
          );

          return {
            signedTxXdr: signedTx.toXDR(),
            signerAddress: params.adminPublicKey,
          };
        },
      });
    }, 'update hackathon');

    if (!result.result.isOk()) {
      const error = result.result.unwrapErr();
      ContractErrorHandler.handleContractError(error, 'update hackathon');
    }

    if (!result.getTransactionResponse) {
      throw new BadRequestException('Transaction response not available');
    }

    return {
      txHash: result.getTransactionResponse.txHash,
    };
  }

  async cancelHackathon(params: {
    adminPublicKey: string;
    adminWalletId: string;
    contractHackathonId: bigint;
  }): Promise<{ refundedAmount: string; txHash: string }> {
    this.logger.log(`Canceling hackathon ${params.contractHackathonId}`);

    this.sorobanClient.options.publicKey = params.adminPublicKey;

    const result = await ContractErrorHandler.wrapContractCall(async () => {
      const tx = await this.sorobanClient.cancel_hackathon({
        owner: params.adminPublicKey,
        hackathon_id: params.contractHackathonId,
      });

      return await tx.signAndSend({
        signTransaction: async (transactionXdr) => {
          const transaction = StellarSDK.TransactionBuilder.fromXDR(
            transactionXdr,
            this.networkPassphrase,
          ) as StellarSDK.Transaction;

          const signedTx = await this.walletSigning.signTransaction(
            params.adminWalletId,
            transaction,
          );

          return {
            signedTxXdr: signedTx.toXDR(),
            signerAddress: params.adminPublicKey,
          };
        },
      });
    }, 'cancel hackathon');

    if (!result.result.isOk()) {
      const error = result.result.unwrapErr();
      ContractErrorHandler.handleContractError(error, 'cancel hackathon');
    }

    if (!result.getTransactionResponse) {
      throw new BadRequestException('Transaction response not available');
    }

    return {
      refundedAmount: result.result.unwrap().toString(),
      txHash: result.getTransactionResponse.txHash,
    };
  }

  async distributePrizes(params: {
    adminPublicKey: string;
    adminWalletId: string;
    contractHackathonId: bigint;
    winners: Array<{ position: number; winnerAddress: string }>;
  }): Promise<{ txHash: string }> {
    this.logger.log(
      `Distributing prizes for hackathon ${params.contractHackathonId}`,
    );

    this.sorobanClient.options.publicKey = params.adminPublicKey;

    const result = await ContractErrorHandler.wrapContractCall(async () => {
      const winnersArg: Array<readonly [number, string]> = params.winners.map(
        (w) => [w.position, w.winnerAddress] as const,
      );

      const tx = await this.sorobanClient.distribute_hackathon_prizes({
        owner: params.adminPublicKey,
        hackathon_id: params.contractHackathonId,
        winners: winnersArg,
      });

      return await tx.signAndSend({
        signTransaction: async (transactionXdr) => {
          const transaction = StellarSDK.TransactionBuilder.fromXDR(
            transactionXdr,
            this.networkPassphrase,
          ) as StellarSDK.Transaction;

          const signedTx = await this.walletSigning.signTransaction(
            params.adminWalletId,
            transaction,
          );

          return {
            signedTxXdr: signedTx.toXDR(),
            signerAddress: params.adminPublicKey,
          };
        },
      });
    }, 'distribute hackathon prizes');

    if (!result.result.isOk()) {
      const error = result.result.unwrapErr();
      ContractErrorHandler.handleContractError(
        error,
        'distribute hackathon prizes',
      );
    }

    if (!result.getTransactionResponse) {
      throw new BadRequestException('Transaction response not available');
    }

    return {
      txHash: result.getTransactionResponse.txHash,
    };
  }
}
