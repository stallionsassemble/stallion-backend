import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as StellarSDK from '@stellar/stellar-sdk';
import { getTokenAddress } from '../common/utils/supported-currencies';
import { EnvConfig } from '../config/env.config';
import { Client, ProjectStatus } from '../soroban/contract-bindings';
import { ContractErrorHandler } from '../soroban/contract-error-handler';
import { WalletSigningService } from '../wallet/wallet-signing.service';

@Injectable()
export class ProjectContractService {
  private readonly logger = new Logger(ProjectContractService.name);
  private readonly contractId: string;
  private readonly networkPassphrase: string;
  readonly sorobanClient: Client;

  constructor(
    private configService: ConfigService,
    private walletSigning: WalletSigningService,
  ) {
    this.contractId = this.configService.getOrThrow<string>(
      EnvConfig.SOROBAN_CONTRACT_ID,
    );
    this.networkPassphrase = this.configService.getOrThrow<string>(
      EnvConfig.SOROBAN_NETWORK_PASSPHRASE,
    );

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
  }): Promise<{ contractProjectId: number; txHash: string }> {
    this.logger.log(
      `Creating GIG escrow for owner ${params.ownerId} with reward ${params.reward}`,
    );

    const tokenAddress = getTokenAddress(
      params.currency,
      this.networkPassphrase,
    );
    const totalReward = BigInt(params.reward);
    const deadlineTimestamp = BigInt(
      Math.floor(params.deadline.getTime() / 1000),
    );

    const milestones = params.milestones.map((m) => ({
      amount: BigInt(m.amount),
      order: m.order,
    }));

    this.sorobanClient.options.publicKey = params.ownerPublicKey;

    const result = await ContractErrorHandler.wrapContractCall(async () => {
      const tx = await this.sorobanClient.create_project_gig({
        owner: params.ownerPublicKey,
        token: tokenAddress,
        total_reward: totalReward,
        milestones,
        deadline: deadlineTimestamp,
      });

      return await tx.signAndSend({
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
    }, 'create GIG project');

    if (!result.result.isOk()) {
      const error = result.result.unwrapErr();
      ContractErrorHandler.handleContractError(error, 'create GIG project');
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

    const result = await ContractErrorHandler.wrapContractCall(async () => {
      const tx = await this.sorobanClient.release_milestone_payment({
        owner: params.ownerPublicKey,
        project_id: BigInt(params.projectId),
        milestone_order: params.milestoneOrder,
        contributor: params.contributorPublicKey,
        amount,
      });

      return await tx.signAndSend({
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
    }, 'release milestone payment');

    if (!result.result.isOk()) {
      const error = result.result.unwrapErr();
      ContractErrorHandler.handleContractError(
        error,
        'release milestone payment',
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
    const deadlineTimestamp = BigInt(
      Math.floor(params.deadline.getTime() / 1000),
    );

    this.sorobanClient.options.publicKey = params.ownerPublicKey;

    const result = await ContractErrorHandler.wrapContractCall(async () => {
      const tx = await this.sorobanClient.create_project_job({
        owner: params.ownerPublicKey,
        token: tokenAddress,
        reward_amount: rewardAmount,
        deadline: deadlineTimestamp,
      });

      return await tx.signAndSend({
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
    }, 'create JOB project');

    if (!result.result.isOk()) {
      const error = result.result.unwrapErr();
      ContractErrorHandler.handleContractError(error, 'create JOB project');
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

  async updateGigProject(params: {
    projectId: number;
    ownerId: string;
    ownerPublicKey: string;
    walletId: string;
    deadline: Date | undefined;
    milestones: Array<{ amount: string; order: number }> | undefined;
  }): Promise<{ txHash: string }> {
    this.logger.log(
      `Updating GIG project ${params.projectId} on smart contract`,
    );

    this.sorobanClient.options.publicKey = params.ownerPublicKey;

    const updateParams = {
      owner: params.ownerPublicKey,
      project_id: BigInt(params.projectId),
      new_deadline: params.deadline
        ? BigInt(Math.floor(params.deadline.getTime() / 1000))
        : undefined,
      new_milestones: params.milestones
        ? params.milestones.map((m) => ({
            amount: BigInt(m.amount),
            order: m.order,
          }))
        : undefined,
    };

    const tx = await this.sorobanClient.update_project_gig(updateParams);

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
      ContractErrorHandler.handleContractError(error, 'update GIG project');
    }

    if (!result.getTransactionResponse) {
      throw new BadRequestException('Transaction response not available');
    }

    const txHash = result.getTransactionResponse.txHash;

    this.logger.log(
      `GIG project ${params.projectId} updated on contract, tx: ${txHash}`,
    );

    return { txHash };
  }

  async updateJobProject(params: {
    projectId: number;
    ownerId: string;
    ownerPublicKey: string;
    walletId: string;
    deadline?: Date;
  }): Promise<{ txHash: string }> {
    this.logger.log(
      `Updating JOB project ${params.projectId} on smart contract`,
    );

    this.sorobanClient.options.publicKey = params.ownerPublicKey;

    const updateParams: Parameters<
      typeof this.sorobanClient.update_project_job
    >[0] = {
      owner: params.ownerPublicKey,
      project_id: BigInt(params.projectId),
      new_deadline:
        params.deadline && BigInt(Math.floor(params.deadline.getTime() / 1000)),
    };

    const tx = await this.sorobanClient.update_project_job(updateParams);

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
      ContractErrorHandler.handleContractError(error, 'update JOB project');
    }

    if (!result.getTransactionResponse) {
      throw new BadRequestException('Transaction response not available');
    }

    const txHash = result.getTransactionResponse.txHash;

    this.logger.log(
      `JOB project ${params.projectId} updated on contract, tx: ${txHash}`,
    );

    return { txHash };
  }

  async cancelGigProject(params: {
    projectId: number;
    ownerId: string;
    ownerPublicKey: string;
    walletId: string;
  }): Promise<{ refundedAmount: string; txHash: string }> {
    this.logger.log(`Cancelling GIG project ${params.projectId}`);

    this.sorobanClient.options.publicKey = params.ownerPublicKey;

    const result = await ContractErrorHandler.wrapContractCall(async () => {
      const tx = await this.sorobanClient.cancel_project_gig({
        owner: params.ownerPublicKey,
        project_id: BigInt(params.projectId),
      });

      return await tx.signAndSend({
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
    }, 'cancel GIG project');

    if (!result.result.isOk()) {
      const error = result.result.unwrapErr();
      ContractErrorHandler.handleContractError(error, 'cancel GIG project');
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

  /**
   * Get all projects from contract
   * Returns array of contract project IDs
   */
  async getProjects(): Promise<number[]> {
    try {
      const assembled = await this.sorobanClient.get_projects();
      const simulated = await assembled.simulate();
      return simulated.result.map(Number);
    } catch (error) {
      this.logger.error('Failed to get projects from contract', error);
      throw error;
    }
  }

  /**
   * Get owner projects from contract
   * Returns array of contract project IDs for a specific owner
   */
  async getOwnerProjects(ownerPublicKey: string): Promise<number[]> {
    try {
      const assembled = await this.sorobanClient.get_owner_projects({
        owner: ownerPublicKey,
      });
      const simulated = await assembled.simulate();
      return simulated.result.map(Number);
    } catch (error) {
      this.logger.error('Failed to get owner projects from contract', error);
      throw error;
    }
  }

  /**
   * Get projects by status from contract
   * Returns array of contract project IDs with specific status
   */
  async getProjectsByStatus(status: string): Promise<number[]> {
    try {
      let contractStatus: ProjectStatus;
      if (status === 'OPEN' || status === 'IN_PROGRESS') {
        // Both OPEN and IN_PROGRESS map to Active in the contract
        contractStatus = { tag: 'Active', values: undefined };
      } else if (status === 'COMPLETED') {
        contractStatus = { tag: 'Completed', values: undefined };
      } else if (status === 'CANCELLED') {
        contractStatus = { tag: 'Cancelled', values: undefined };
      } else {
        throw new BadRequestException(`Invalid project status: ${status}`);
      }

      const assembled = await this.sorobanClient.get_projects_by_status({
        status: contractStatus,
      });
      const simulated = await assembled.simulate();
      return simulated.result.map(Number);
    } catch (error) {
      this.logger.error(
        'Failed to get projects by status from contract',
        error,
      );
      throw error;
    }
  }
}
