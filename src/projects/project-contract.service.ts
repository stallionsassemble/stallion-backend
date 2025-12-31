import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as StellarSDK from '@stellar/stellar-sdk';
import { getTokenAddress } from '../bounties/utils/supported-currencies';
import { PrismaService } from '../common/prisma/prisma.service';
import { EnvConfig } from '../config/env.config';
import { Client } from '../soroban/contract-bindings';
import { WalletSigningService } from '../wallet/wallet-signing.service';

@Injectable()
export class ProjectContractService {
  private readonly logger = new Logger(ProjectContractService.name);
  private readonly contractId: string;
  private readonly networkPassphrase: string;
  private readonly sorobanClient: Client;

  constructor(
    private configService: ConfigService,
    private walletSigning: WalletSigningService,
    private prisma: PrismaService,
  ) {
    this.contractId = this.configService.getOrThrow<string>(
      EnvConfig.SOROBAN_CONTRACT_ID,
    );
    const network = this.configService.getOrThrow<string>(
      EnvConfig.SOROBAN_NETWORK,
    );
    this.networkPassphrase =
      network === 'testnet'
        ? 'Test SDF Network ; September 2015'
        : 'Public Global Stellar Network ; September 2015';

    this.sorobanClient = new Client({
      contractId: this.contractId,
      networkPassphrase: this.networkPassphrase,
      rpcUrl: this.configService.getOrThrow<string>(EnvConfig.SOROBAN_RPC_URL),
    });

    this.logger.log('ProjectContractService initialized');
  }

  async createGigEscrow(params: {
    ownerId: string;
    ownerPublicKey: string;
    walletId: string;
    reward: string;
    currency: string;
    milestones: Array<{ amount: string; order: number }>;
    deadline: Date;
    platformFee: string;
  }): Promise<{ contractProjectId: number; txHash: string }> {
    this.logger.log(
      `Creating GIG escrow for owner ${params.ownerId} with reward ${params.reward}`,
    );

    const tokenAddress = getTokenAddress(
      params.currency,
      this.networkPassphrase,
    );
    const totalReward = BigInt(params.reward);
    const platformFee = BigInt(params.platformFee);
    const deadlineTimestamp = BigInt(
      Math.floor(params.deadline.getTime() / 1000),
    );

    const milestones = params.milestones.map((m) => ({
      amount: BigInt(m.amount),
      order: m.order,
    }));

    this.sorobanClient.options.publicKey = params.ownerPublicKey;

    const tx = await this.sorobanClient.create_project_gig({
      owner: params.ownerPublicKey,
      token: tokenAddress,
      total_reward: totalReward,
      milestones,
      deadline: deadlineTimestamp,
      platform_fee: platformFee,
    });

    const result = await tx.signAndSend({
      signTransaction: async (transactionXdr) => {
        const transaction = StellarSDK.TransactionBuilder.fromXDR(
          transactionXdr,
          this.networkPassphrase,
        ) as StellarSDK.Transaction;

        const signedTx = await this.walletSigning.signTransaction(
          params.walletId,
          transaction,
        );

        return {
          signedTxXdr: signedTx.toXDR(),
          signerAddress: params.ownerPublicKey,
        };
      },
    });

    if (!result.result.isOk()) {
      const error = result.result.unwrapErr();
      this.logger.error('Contract invocation failed', error);
      throw new BadRequestException(
        `Failed to create GIG project on contract: ${JSON.stringify(error)}`,
      );
    }

    if (!result.getTransactionResponse) {
      throw new BadRequestException('Transaction response not available');
    }

    const projectId = Number(result.result.unwrap().toString());
    const txHash = result.getTransactionResponse.txHash;

    this.logger.log(
      `GIG project created on contract with ID: ${projectId}, tx: ${txHash}`,
    );

    return {
      contractProjectId: projectId,
      txHash,
    };
  }

  async releaseMilestonePayment(params: {
    projectId: number;
    milestoneOrder: number;
    contributorPublicKey: string;
    amount: string;
    ownerId: string;
    ownerPublicKey: string;
    walletId: string;
  }): Promise<{ txHash: string }> {
    this.logger.log(
      `Releasing milestone payment for project ${params.projectId}, milestone order ${params.milestoneOrder}`,
    );

    const amount = BigInt(params.amount);

    this.sorobanClient.options.publicKey = params.ownerPublicKey;

    const tx = await this.sorobanClient.release_milestone_payment({
      owner: params.ownerPublicKey,
      project_id: params.projectId,
      milestone_order: params.milestoneOrder,
      contributor: params.contributorPublicKey,
      amount,
    });

    const result = await tx.signAndSend({
      signTransaction: async (transactionXdr) => {
        const transaction = StellarSDK.TransactionBuilder.fromXDR(
          transactionXdr,
          this.networkPassphrase,
        ) as StellarSDK.Transaction;

        const signedTx = await this.walletSigning.signTransaction(
          params.walletId,
          transaction,
        );

        return {
          signedTxXdr: signedTx.toXDR(),
          signerAddress: params.ownerPublicKey,
        };
      },
    });

    if (!result.result.isOk()) {
      const error = result.result.unwrapErr();
      this.logger.error('Contract invocation failed', error);
      throw new BadRequestException(
        `Failed to release milestone payment: ${JSON.stringify(error)}`,
      );
    }

    if (!result.getTransactionResponse) {
      throw new BadRequestException('Transaction response not available');
    }

    const txHash = result.getTransactionResponse.txHash;

    this.logger.log(
      `Milestone payment released for project ${params.projectId}, tx: ${txHash}`,
    );

    return { txHash };
  }

  async createJobProject(params: {
    ownerId: string;
    ownerPublicKey: string;
    walletId: string;
    rewardAmount: string;
    currency: string;
    platformFee: string;
    deadline: Date;
  }): Promise<{ contractProjectId: number; txHash: string }> {
    this.logger.log(
      `Creating JOB project for owner ${params.ownerId} with reward ${params.rewardAmount}`,
    );

    const tokenAddress = getTokenAddress(
      params.currency,
      this.networkPassphrase,
    );
    const rewardAmount = BigInt(params.rewardAmount);
    const platformFee = BigInt(params.platformFee);
    const deadlineTimestamp = BigInt(
      Math.floor(params.deadline.getTime() / 1000),
    );

    this.sorobanClient.options.publicKey = params.ownerPublicKey;

    const tx = await this.sorobanClient.create_project_job({
      owner: params.ownerPublicKey,
      token: tokenAddress,
      reward_amount: rewardAmount,
      platform_fee: platformFee,
      deadline: deadlineTimestamp,
    });

    const result = await tx.signAndSend({
      signTransaction: async (transactionXdr) => {
        const transaction = StellarSDK.TransactionBuilder.fromXDR(
          transactionXdr,
          this.networkPassphrase,
        ) as StellarSDK.Transaction;

        const signedTx = await this.walletSigning.signTransaction(
          params.walletId,
          transaction,
        );

        return {
          signedTxXdr: signedTx.toXDR(),
          signerAddress: params.ownerPublicKey,
        };
      },
    });

    if (!result.result.isOk()) {
      const error = result.result.unwrapErr();
      this.logger.error('Contract invocation failed', error);
      throw new BadRequestException(
        `Failed to create JOB project on contract: ${JSON.stringify(error)}`,
      );
    }

    if (!result.getTransactionResponse) {
      throw new BadRequestException('Transaction response not available');
    }

    const projectId = Number(result.result.unwrap().toString());
    const txHash = result.getTransactionResponse.txHash;

    this.logger.log(
      `JOB project created on contract with ID: ${projectId}, tx: ${txHash}`,
    );

    return {
      contractProjectId: projectId,
      txHash,
    };
  }

  async cancelGigProject(params: {
    projectId: number;
    ownerId: string;
    ownerPublicKey: string;
    walletId: string;
  }): Promise<{ refundedAmount: string; txHash: string }> {
    this.logger.log(`Cancelling GIG project ${params.projectId}`);

    this.sorobanClient.options.publicKey = params.ownerPublicKey;

    const tx = await this.sorobanClient.cancel_project_gig({
      owner: params.ownerPublicKey,
      project_id: params.projectId,
    });

    const result = await tx.signAndSend({
      signTransaction: async (transactionXdr) => {
        const transaction = StellarSDK.TransactionBuilder.fromXDR(
          transactionXdr,
          this.networkPassphrase,
        ) as StellarSDK.Transaction;

        const signedTx = await this.walletSigning.signTransaction(
          params.walletId,
          transaction,
        );

        return {
          signedTxXdr: signedTx.toXDR(),
          signerAddress: params.ownerPublicKey,
        };
      },
    });

    if (!result.result.isOk()) {
      const error = result.result.unwrapErr();
      this.logger.error('Contract invocation failed', error);
      throw new BadRequestException(
        `Failed to cancel GIG project: ${JSON.stringify(error)}`,
      );
    }

    if (!result.getTransactionResponse) {
      throw new BadRequestException('Transaction response not available');
    }

    const refundedAmount = result.result.unwrap().toString();
    const txHash = result.getTransactionResponse.txHash;

    this.logger.log(
      `GIG project cancelled, refunded: ${refundedAmount}, tx: ${txHash}`,
    );

    return {
      refundedAmount,
      txHash,
    };
  }
}
