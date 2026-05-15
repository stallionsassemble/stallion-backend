import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as StellarSDK from '@stellar/stellar-sdk';
import { EnvConfig } from '../config/env.config';
import { Client as SorobanClient } from '../soroban/contract-bindings';
import { ContractErrorHandler } from '../soroban/contract-error-handler';
import { WalletSigningService } from '../wallet/wallet-signing.service';

@Injectable()
export class BountyContractService {
  private readonly logger = new Logger(BountyContractService.name);
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

    this.sorobanClient = new SorobanClient({
      contractId: this.contractId,
      networkPassphrase: this.networkPassphrase,
      rpcUrl: this.configService.getOrThrow<string>(EnvConfig.SOROBAN_RPC_URL),
    });

    this.logger.log('BountyContractService initialized');
  }

  /**
   * Create a bounty on the smart contract
   */
  async createBounty(params: {
    ownerPublicKey: string;
    walletId: string;
    token: string;
    reward: string;
    distribution: Array<{ rank: number; percentage: number }>;
    submissionDeadline: Date;
    judgingDeadline: Date;
    title: string;
  }): Promise<{ contractBountyId: bigint; txHash: string }> {
    this.logger.log(
      `Creating bounty for owner ${params.ownerPublicKey} with reward ${params.reward}`,
    );

    const rewardAmount = BigInt(params.reward);
    const distribution: Array<readonly [number, number]> =
      params.distribution.map((d) => [d.rank, d.percentage] as const);

    this.sorobanClient.options.publicKey = params.ownerPublicKey;

    const result = await ContractErrorHandler.wrapContractCall(async () => {
      const tx = await this.sorobanClient.create_bounty({
        owner: params.ownerPublicKey,
        token: params.token,
        reward: rewardAmount,
        distribution,
        submission_deadline: BigInt(
          Math.floor(params.submissionDeadline.getTime() / 1000),
        ),
        judging_deadline: BigInt(
          Math.floor(params.judgingDeadline.getTime() / 1000),
        ),
        title: params.title,
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
    }, 'create bounty');

    if (!result.result.isOk()) {
      const error = result.result.unwrapErr();
      ContractErrorHandler.handleContractError(error, 'create bounty');
    }

    if (!result.getTransactionResponse) {
      throw new BadRequestException('Transaction response not available');
    }

    const bountyId = BigInt(result.result.unwrap().toString());
    const txHash = result.getTransactionResponse.txHash;

    this.logger.log(
      `Bounty created on contract with ID: ${bountyId}, tx: ${txHash}`,
    );

    return {
      contractBountyId: bountyId,
      txHash,
    };
  }

  /**
   * Update a bounty on the smart contract
   */
  async updateBounty(params: {
    ownerPublicKey: string;
    walletId: string;
    bountyId: bigint;
    title?: string;
    distribution?: Array<{ position: number; percentage: number }>;
    submissionDeadline?: Date;
  }): Promise<{ txHash: string }> {
    this.logger.log(`Updating bounty ${params.bountyId} on smart contract`);

    this.sorobanClient.options.publicKey = params.ownerPublicKey;

    const updateParams = {
      owner: params.ownerPublicKey,
      bounty_id: BigInt(params.bountyId),
      new_title: params.title || undefined,
      new_distribution: params.distribution
        ? params.distribution.map((d) => [d.position, d.percentage] as const)
        : [],
      new_submission_deadline: params.submissionDeadline
        ? BigInt(Math.floor(params.submissionDeadline.getTime() / 1000))
        : undefined,
    };

    const tx = await this.sorobanClient.update_bounty(updateParams);

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
      ContractErrorHandler.handleContractError(error, 'update bounty');
    }

    if (!result.getTransactionResponse) {
      throw new BadRequestException('Transaction response not available');
    }

    const txHash = result.getTransactionResponse.txHash;

    this.logger.log(
      `Bounty ${params.bountyId} updated on contract, tx: ${txHash}`,
    );

    return { txHash };
  }

  /**
   * Apply to a bounty on the smart contract
   */
  async applyToBounty(params: {
    applicantPublicKey: string;
    walletId: string;
    bountyId: bigint;
    submissionLink: string;
  }): Promise<{ txHash: string }> {
    this.logger.log(
      `Applying to bounty ${params.bountyId} for applicant ${params.applicantPublicKey}`,
    );

    this.sorobanClient.options.publicKey = params.applicantPublicKey;

    const result = await ContractErrorHandler.wrapContractCall(async () => {
      const tx = await this.sorobanClient.apply_to_bounty({
        applicant: params.applicantPublicKey,
        bounty_id: BigInt(params.bountyId),
        submission_link: params.submissionLink,
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
            signerAddress: params.applicantPublicKey,
          };
        },
      });
    }, 'apply to bounty');

    if (!result.result.isOk()) {
      const error = result.result.unwrapErr();
      ContractErrorHandler.handleContractError(error, 'apply to bounty');
    }

    if (!result.getTransactionResponse) {
      throw new BadRequestException('Transaction response not available');
    }

    const txHash = result.getTransactionResponse.txHash;

    this.logger.log(`Applied to bounty ${params.bountyId}, tx: ${txHash}`);

    return { txHash };
  }

  /**
   * Update submission for a bounty on the smart contract
   */
  async updateSubmission(params: {
    applicantPublicKey: string;
    walletId: string;
    bountyId: bigint;
    newSubmissionLink: string;
  }): Promise<{ txHash: string }> {
    this.logger.log(
      `Updating submission for bounty ${params.bountyId} for applicant ${params.applicantPublicKey}`,
    );

    this.sorobanClient.options.publicKey = params.applicantPublicKey;

    const result = await ContractErrorHandler.wrapContractCall(async () => {
      const tx = await this.sorobanClient.update_submission({
        applicant: params.applicantPublicKey,
        bounty_id: BigInt(params.bountyId),
        new_submission_link: params.newSubmissionLink,
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
            signerAddress: params.applicantPublicKey,
          };
        },
      });
    }, 'update submission');

    if (!result.result.isOk()) {
      const error = result.result.unwrapErr();
      ContractErrorHandler.handleContractError(error, 'update submission');
    }

    if (!result.getTransactionResponse) {
      throw new BadRequestException('Transaction response not available');
    }

    const txHash = result.getTransactionResponse.txHash;

    this.logger.log(
      `Updated submission for bounty ${params.bountyId}, tx: ${txHash}`,
    );

    return { txHash };
  }

  /**
   * Select winners for a bounty on the smart contract
   */
  async selectWinners(params: {
    ownerPublicKey: string;
    walletId: string;
    bountyId: bigint;
    winners: string[];
  }): Promise<{ txHash: string }> {
    this.logger.log(`Selecting winners for bounty ${params.bountyId}`);

    this.sorobanClient.options.publicKey = params.ownerPublicKey;

    const result = await ContractErrorHandler.wrapContractCall(async () => {
      const tx = await this.sorobanClient.select_winners({
        owner: params.ownerPublicKey,
        bounty_id: BigInt(params.bountyId),
        winners: params.winners,
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
    }, 'select winners');

    if (!result.result.isOk()) {
      const error = result.result.unwrapErr();
      ContractErrorHandler.handleContractError(error, 'select winners');
    }

    if (!result.getTransactionResponse) {
      throw new BadRequestException('Transaction response not available');
    }

    const txHash = result.getTransactionResponse.txHash;

    this.logger.log(
      `Winners selected for bounty ${params.bountyId}, tx: ${txHash}`,
    );

    return { txHash };
  }

  /**
   * Close a bounty on the smart contract
   */
  async closeBounty(params: {
    ownerPublicKey: string;
    walletId: string;
    bountyId: bigint;
  }): Promise<{ txHash: string }> {
    this.logger.log(`Closing bounty ${params.bountyId}`);

    this.sorobanClient.options.publicKey = params.ownerPublicKey;

    const result = await ContractErrorHandler.wrapContractCall(async () => {
      const tx = await this.sorobanClient.close_bounty({
        owner: params.ownerPublicKey,
        bounty_id: BigInt(params.bountyId),
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
    }, 'close bounty');

    if (!result.result.isOk()) {
      const error = result.result.unwrapErr();
      ContractErrorHandler.handleContractError(error, 'close bounty');
    }

    if (!result.getTransactionResponse) {
      throw new BadRequestException('Transaction response not available');
    }

    const txHash = result.getTransactionResponse.txHash;

    this.logger.log(`Bounty closed, tx: ${txHash}`);

    return {
      txHash,
    };
  }

  /**
   * Get all bounties from contract
   * Returns array of contract bounty IDs
   */
  async getBounties(): Promise<bigint[]> {
    try {
      const assembled = await this.sorobanClient.get_bounties();
      const simulated = await assembled.simulate();
      return simulated.result;
    } catch (error) {
      this.logger.error('Failed to get bounties from contract', error);
      throw error;
    }
  }

  /**
   * Get owner bounties from contract
   * Returns array of contract bounty IDs for a specific owner
   */
  async getOwnerBounties(ownerPublicKey: string): Promise<bigint[]> {
    try {
      const assembled = await this.sorobanClient.get_owner_bounties({
        owner: ownerPublicKey,
      });
      const simulated = await assembled.simulate();
      return simulated.result;
    } catch (error) {
      this.logger.error('Failed to get owner bounties from contract', error);
      throw error;
    }
  }

  /**
   * Get active bounties from contract
   * Returns array of contract bounty IDs
   */
  async getActiveBounties(): Promise<bigint[]> {
    try {
      const assembled = await this.sorobanClient.get_active_bounties();
      const simulated = await assembled.simulate();
      return simulated.result;
    } catch (error) {
      this.logger.error('Failed to get active bounties from contract', error);
      throw error;
    }
  }

  /**
   * Get bounties by status from contract
   * Returns array of contract bounty IDs with specific status
   */
  async getBountiesByStatus(status: string): Promise<bigint[]> {
    try {
      // Map database status to contract status
      let contractStatus: any;
      if (status === 'ACTIVE') {
        contractStatus = { tag: 'Active' };
      } else if (status === 'COMPLETED') {
        contractStatus = { tag: 'Completed' };
      } else if (status === 'CLOSED') {
        contractStatus = { tag: 'Closed' };
      } else {
        throw new BadRequestException(`Invalid bounty status: ${status}`);
      }

      const assembled = await this.sorobanClient.get_bounties_by_status({
        status: contractStatus,
      });
      const simulated = await assembled.simulate();
      return simulated.result;
    } catch (error) {
      this.logger.error(
        'Failed to get bounties by status from contract',
        error,
      );
      throw error;
    }
  }
}
