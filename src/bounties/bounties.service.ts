import { InjectQueue } from '@nestjs/bullmq';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  BountyStatus,
  BountySubmission,
  Prisma,
  Role,
  type Bounty,
} from '@prisma/client';
import * as StellarSDK from '@stellar/stellar-sdk';
import { Queue } from 'bullmq';
import { createHash } from 'crypto';
import { SanitizedUser, sanitizeUser } from 'src/common/utils/user.util';
import { ReputationService } from 'src/reputation/reputation.service';
import { ensureTrustline } from 'src/wallet/utils/trustline.util';
import { PrismaService } from '../common/prisma/prisma.service';
import { EnvConfig } from '../config/env.config';
import type { Status } from '../soroban/contract-bindings';
import {
  networks,
  Client as SorobanClient,
} from '../soroban/contract-bindings';
import { StellarAccountService } from '../soroban/stellar-account.service';
import { StellarWalletService } from '../wallet/stellar-wallet.service';
import { WalletSigningService } from '../wallet/wallet-signing.service';
import { WalletService } from '../wallet/wallet.service';
import { ApplyToBountyDto } from './dto/apply-to-bounty.dto';
import {
  BountyWinnersResponseDto,
  SelectWinnersResponseDto,
} from './dto/bounty-winner-response.dto';
import { CreateBountyDto } from './dto/create-bounty.dto';
import { SelectWinnersDto } from './dto/select-winners.dto';
import { UpdateBountyApplicationDto } from './dto/update-bounty-application.dto';
import { UpdateBountyDto } from './dto/update-bounty.dto';
import {
  validateSubmissionData,
  type SubmissionField,
} from './utils/submission-validator';
import {
  getSupportedCurrencies,
  getTokenAddress,
  SupportedCurrency,
} from './utils/supported-currencies';
import {
  validateWalletForBountyCreation,
  validateWalletForTransaction,
} from './utils/wallet-validator';

/**
 * Bounty Service
 * Handles all bounty-related operations with Soroban smart contract
 */
@Injectable()
export class BountiesService {
  private readonly logger = new Logger(BountiesService.name);
  private sorobanClient: SorobanClient;
  private readonly contractId: string;
  private readonly networkPassphrase: string;

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
    private walletService: WalletService,
    private reputationService: ReputationService,
    private walletSigning: WalletSigningService,
    private stellarAccount: StellarAccountService,
    private stellarWallet: StellarWalletService,
    @InjectQueue('bounty-winner') private bountyWinnerQueue: Queue,
  ) {
    this.contractId = this.configService.getOrThrow<string>(
      EnvConfig.SOROBAN_CONTRACT_ID,
    );
    const network = this.configService.getOrThrow<string>(
      EnvConfig.SOROBAN_NETWORK,
    );
    const rpcUrl = this.configService.getOrThrow<string>(
      EnvConfig.SOROBAN_RPC_URL,
    );

    this.logger.log(
      'BountiesService initialized with individual wallet signing',
    );
    this.networkPassphrase =
      networks[network as keyof typeof networks].networkPassphrase;

    // Initialize Soroban client
    this.sorobanClient = new SorobanClient({
      contractId: this.contractId,
      networkPassphrase: this.networkPassphrase,
      rpcUrl,
    });
  }

  /**
   * Get all bounties
   * Returns database bounties based on contract bounty IDs
   */
  async getAllBounties(): Promise<Bounty[]> {
    try {
      const assembled = await this.sorobanClient.get_bounties();
      const simulated = await assembled.simulate();
      const contractBountyIds = simulated.result.map(Number);

      // Fetch bounties from database based on contract IDs
      const bounties = await this.prisma.bounty.findMany({
        where: {
          contractBountyId: {
            in: contractBountyIds,
          },
        },
        include: {
          owner: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      // Sanitize owner data
      bounties.map((bounty) => {
        return {
          ...bounty,
          owner: sanitizeUser(bounty.owner),
        };
      });

      return bounties;
    } catch (error) {
      this.logger.error('Failed to get bounties', error);
      throw error;
    }
  }

  /**
   * Get bounties by owner
   * Returns database bounties based on contract bounty IDs
   */
  async getOwnerBounties(userId: string): Promise<Bounty[]> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        include: { wallet: true },
      });

      if (!user || !user.wallet) {
        throw new NotFoundException('User or wallet not found');
      }
      if (user.role !== Role.PROJECT_OWNER) {
        throw new ForbiddenException('User is not a project owner');
      }

      const assembled = await this.sorobanClient.get_owner_bounties({
        owner: user.wallet.publicKey,
      });
      const simulated = await assembled.simulate();

      const contractBountyIds = simulated.result.map(Number);

      // Fetch bounties from database based on contract IDs
      const bounties = await this.prisma.bounty.findMany({
        where: {
          contractBountyId: {
            in: contractBountyIds,
          },
        },
        include: {
          owner: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      // Sanitize owner data
      bounties.map((bounty) => {
        return {
          ...bounty,
          owner: sanitizeUser(bounty.owner),
        };
      });

      return bounties;
    } catch (error) {
      this.logger.error('Failed to get owner bounties', error);
      throw error;
    }
  }

  /**
   * Get active bounties
   * Returns database bounties based on contract bounty IDs
   */
  async getActiveBounties(): Promise<Bounty[]> {
    try {
      const assembled = await this.sorobanClient.get_active_bounties();
      const simulated = await assembled.simulate();
      const contractBountyIds = simulated.result.map(Number);

      // Fetch bounties from database based on contract IDs
      const bounties = await this.prisma.bounty.findMany({
        where: {
          contractBountyId: {
            in: contractBountyIds,
          },
        },
        include: {
          owner: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      // Sanitize owner data
      bounties.map((bounty) => {
        return {
          ...bounty,
          owner: sanitizeUser(bounty.owner),
        };
      });

      return bounties;
    } catch (error) {
      this.logger.error('Failed to get active bounties', error);
      throw error;
    }
  }

  /**
   * Get bounty details
   * Fetches from both contract and database, with contract details taking precedence
   */
  async getBounty(
    dbBountyId: string,
  ): Promise<Bounty & { ownerDetails: SanitizedUser }> {
    try {
      // Fetch database bounty details first
      const dbBounty = await this.prisma.bounty.findUnique({
        where: { id: dbBountyId },
        include: {
          owner: true,
        },
      });

      if (!dbBounty || dbBounty.contractBountyId === null) {
        throw new NotFoundException('Bounty not found');
      }

      const contractBountyId = dbBounty.contractBountyId;

      // Make sure contractBountyId is valid u32
      if (contractBountyId < 0 || contractBountyId > 4294967295) {
        throw new NotFoundException('Bounty not found');
      }

      const assembled = await this.sorobanClient.get_bounty({
        bounty_id: contractBountyId,
      });
      const simulated = await assembled.simulate();

      if (!simulated.result.isOk()) {
        throw new NotFoundException('Bounty not found');
      }

      const contractBounty = simulated.result.unwrap();

      // Convert contract status to database status
      let status: BountyStatus = BountyStatus.ACTIVE;
      if (contractBounty.status.tag === 'Active') {
        status = BountyStatus.ACTIVE;
      } else if (contractBounty.status.tag === 'Completed') {
        status = BountyStatus.COMPLETED;
      } else if (contractBounty.status.tag === 'Closed') {
        status = BountyStatus.CLOSED;
      }

      // Convert distribution Map to array format matching database schema
      const distributionArray: Array<{ rank: number; percentage: number }> = [];
      contractBounty.distribution.forEach((percentage, rank) => {
        distributionArray.push({ rank, percentage });
      });
      // Sort by rank to ensure consistent ordering
      distributionArray.sort((a, b) => a.rank - b.rank);

      // Convert submission_deadline from u64 (seconds) to Date
      const submissionDeadline = new Date(
        Number(contractBounty.submission_deadline) * 1000,
      );

      // Consolidate contract and database details
      // Contract details take precedence
      return {
        ...dbBounty,
        title: contractBounty.title,
        token: contractBounty.token,
        reward: contractBounty.reward.toString(),
        status,
        rewardDistribution: distributionArray,
        submissionDeadline,
        ownerDetails: sanitizeUser(dbBounty.owner),
      };
    } catch (error) {
      this.logger.error('Failed to get bounty', error);
      throw error;
    }
  }

  /**
   * Create a new bounty
   */
  async createBounty(
    userId: string,
    dto: CreateBountyDto,
  ): Promise<{ message: string; bounty: Bounty }> {
    try {
      // Get user from database
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        include: { wallet: true },
      });

      if (!user || !user.wallet) {
        throw new NotFoundException('User or wallet not found');
      }

      if (user.role !== Role.PROJECT_OWNER) {
        throw new ForbiddenException('Only project owners can create bounties');
      }

      // Validate wallet readiness before proceeding
      await validateWalletForBountyCreation(
        user.wallet.publicKey,
        dto.reward,
        dto.rewardCurrency,
        this.configService.getOrThrow<string>(EnvConfig.SOROBAN_RPC_URL),
        this.configService.getOrThrow<string>(EnvConfig.SOROBAN_HORIZON_URL),
        this.networkPassphrase,
      );

      // Get token address from currency
      const tokenAddress = getTokenAddress(
        dto.rewardCurrency,
        this.networkPassphrase,
      );

      // Convert reward to BigInt for contract
      const rewardAmount = BigInt(dto.reward);

      // Convert distribution to contract format
      const distribution: Array<readonly [number, number]> =
        dto.distribution.map((d) => [d.rank, d.percentage] as const);

      // Validate distribution sums to 100
      const totalPercentage = dto.distribution.reduce(
        (sum, d) => sum + d.percentage,
        0,
      );
      if (totalPercentage !== 100) {
        throw new BadRequestException('Distribution must sum to 100%');
      }

      // Parse dates
      const submissionDeadline = new Date(dto.submissionDeadline);
      const judgingDeadline = new Date(dto.judgingDeadline);

      // Extract wallet properties for use in callbacks
      const walletId = user.wallet.id;
      const walletPublicKey = user.wallet.publicKey;

      // Set the public key for the Soroban client
      this.sorobanClient.options.publicKey = walletPublicKey;

      // Create bounty transaction
      const tx = await this.sorobanClient.create_bounty({
        owner: walletPublicKey,
        token: tokenAddress,
        reward: rewardAmount,
        distribution,
        submission_deadline: BigInt(
          Math.floor(submissionDeadline.getTime() / 1000),
        ),
        judging_deadline: BigInt(Math.floor(judgingDeadline.getTime() / 1000)),
        title: dto.title,
      });

      // Sign and send transaction
      const result = await tx.signAndSend({
        signTransaction: async (transactionXdr) => {
          const transaction = StellarSDK.TransactionBuilder.fromXDR(
            transactionXdr,
            this.networkPassphrase,
          ) as StellarSDK.Transaction;

          const signedTx = await this.walletSigning.signTransaction(
            walletId,
            transaction,
          );

          return {
            signedTxXdr: signedTx.toXDR(),
            signerAddress: walletPublicKey,
          };
        },
      });

      // Handle transaction result
      if (!result.result.isOk()) {
        const error = result.result.unwrapErr();
        this.logger.error('Contract invocation failed', error);
        throw new BadRequestException(
          `Failed to create bounty on contract: ${JSON.stringify(error)}`,
        );
      }

      if (!result.getTransactionResponse) {
        throw new BadRequestException('Transaction response not available');
      }

      const bountyId = Number(result.result.unwrap().toString());
      const txHash = result.getTransactionResponse.txHash;

      this.logger.log(
        `Bounty created on contract with ID: ${bountyId}, tx: ${txHash}`,
      );

      // Store bounty in database
      const bounty = await this.prisma.bounty.create({
        data: {
          title: dto.title,
          shortDescription: dto.shortDescription,
          description: dto.description,
          reward: dto.reward.toString(),
          token: tokenAddress,
          rewardCurrency: dto.rewardCurrency,
          rewardDistribution:
            dto.distribution as unknown as Prisma.InputJsonValue,
          submissionFields:
            dto.submissionFields as unknown as Prisma.InputJsonValue,
          attachments: dto.attachments as unknown as Prisma.InputJsonValue,
          skills: dto.skills || [],
          submissionDeadline,
          judgingDeadline,
          ownerId: userId,
          contractBountyId: bountyId,
          txHash,
          status: 'ACTIVE',
        },
      });

      return {
        message: 'Bounty created successfully',
        bounty,
      };
    } catch (error) {
      this.logger.error('Failed to create bounty', error);
      throw error;
    }
  }

  /**
   * Update bounty
   */
  async updateBounty(
    userId: string,
    dbBountyId: string,
    dto: UpdateBountyDto,
  ): Promise<{ message: string; bounty: Bounty }> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        include: { wallet: true },
      });

      if (!user || !user.wallet) {
        throw new NotFoundException('User or wallet not found');
      }

      // Validate wallet has sufficient XLM for transaction
      await validateWalletForTransaction(
        user.wallet.publicKey,
        this.configService.getOrThrow<string>(EnvConfig.SOROBAN_HORIZON_URL),
      );

      // Verify user owns the bounty
      const existingBounty = await this.getBounty(dbBountyId);
      if (existingBounty.ownerId !== user.id) {
        throw new ForbiddenException('You do not own this bounty');
      }

      const contractBountyId = existingBounty.contractBountyId;

      // Validate submission deadline against judging deadline
      if (dto.submissionDeadline) {
        const newSubmissionDeadline = new Date(dto.submissionDeadline);
        const judgingDeadline = existingBounty.judgingDeadline;

        if (judgingDeadline && newSubmissionDeadline >= judgingDeadline) {
          throw new BadRequestException(
            'Submission deadline must be before judging deadline',
          );
        }
      }

      // Prepare update parameters
      const distribution: Array<readonly [number, number]> = dto.distribution
        ? dto.distribution.map((d) => [d.rank, d.percentage] as const)
        : [];

      const submissionDeadline = dto.submissionDeadline
        ? new Date(dto.submissionDeadline)
        : undefined;

      // Set the public key for the Soroban client
      this.sorobanClient.options.publicKey = user.wallet.publicKey;

      const tx = await this.sorobanClient.update_bounty({
        owner: user.wallet.publicKey,
        bounty_id: contractBountyId,
        new_title: dto.title || undefined,
        new_distribution: distribution,
        new_submission_deadline: submissionDeadline
          ? BigInt(Math.floor(submissionDeadline.getTime() / 1000))
          : undefined,
      });

      // Sign and send transaction
      const result = await tx.signAndSend({
        signTransaction: async (transactionXdr) => {
          const transaction = StellarSDK.TransactionBuilder.fromXDR(
            transactionXdr,
            this.networkPassphrase,
          ) as StellarSDK.Transaction;

          const signedTx = await this.walletSigning.signTransaction(
            user.wallet!.id,
            transaction,
          );

          return {
            signedTxXdr: signedTx.toXDR(),
            signerAddress: user.wallet!.publicKey,
          };
        },
      });

      // Handle transaction result
      if (!result.result.isOk()) {
        const error = result.result.unwrapErr();
        this.logger.error('Contract invocation failed', error);
        throw new BadRequestException(
          `Failed to update bounty on contract: ${JSON.stringify(error)}`,
        );
      }

      if (!result.getTransactionResponse) {
        throw new BadRequestException('Transaction response not available');
      }

      const txHash = result.getTransactionResponse.txHash;

      // Update in database
      const bounty = await this.prisma.bounty.update({
        where: { id: dbBountyId },
        data: {
          ...(dto.title && { title: dto.title }),
          ...(dto.shortDescription && {
            shortDescription: dto.shortDescription,
          }),
          ...(dto.description && { description: dto.description }),
          ...(dto.skills && { skills: dto.skills }),
          ...(dto.distribution && {
            rewardDistribution:
              dto.distribution as unknown as Prisma.InputJsonValue,
          }),
          ...(dto.submissionFields && {
            submissionFields:
              dto.submissionFields as unknown as Prisma.InputJsonValue,
          }),
          ...(dto.attachments && {
            attachments: dto.attachments as unknown as Prisma.InputJsonValue,
          }),
          ...(submissionDeadline && {
            submissionDeadline,
          }),
        },
      });

      this.logger.log(`Bounty updated: ${dbBountyId}, tx: ${txHash}`);

      return {
        message: 'Bounty updated successfully',
        bounty,
      };
    } catch (error) {
      this.logger.error('Failed to update bounty', error);
      throw error;
    }
  }

  /**
   * Delete bounty
   */
  async deleteBounty(
    userId: string,
    dbBountyId: string,
  ): Promise<{ message: string }> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        include: { wallet: true },
      });

      if (!user || !user.wallet) {
        throw new NotFoundException('User or wallet not found');
      }

      // Validate wallet has sufficient XLM for transaction
      await validateWalletForTransaction(
        user.wallet.publicKey,
        this.configService.getOrThrow<string>(EnvConfig.SOROBAN_HORIZON_URL),
      );

      // Verify user owns the bounty
      const bounty = await this.getBounty(dbBountyId);
      if (bounty.ownerId !== user.id) {
        throw new ForbiddenException('You do not own this bounty');
      }

      const contractBountyId = bounty.contractBountyId;

      // Set the public key for the Soroban client
      this.sorobanClient.options.publicKey = user.wallet.publicKey;

      const tx = await this.sorobanClient.delete_bounty({
        owner: user.wallet.publicKey,
        bounty_id: contractBountyId,
      });

      // Sign and send transaction
      const result = await tx.signAndSend({
        signTransaction: async (transactionXdr) => {
          const transaction = StellarSDK.TransactionBuilder.fromXDR(
            transactionXdr,
            this.networkPassphrase,
          ) as StellarSDK.Transaction;

          const signedTx = await this.walletSigning.signTransaction(
            user.wallet!.id,
            transaction,
          );

          return {
            signedTxXdr: signedTx.toXDR(),
            signerAddress: user.wallet!.publicKey,
          };
        },
      });

      // Handle transaction result
      if (!result.result.isOk()) {
        const error = result.result.unwrapErr();
        this.logger.error('Contract invocation failed', error);
        throw new BadRequestException(
          `Failed to delete bounty on contract: ${JSON.stringify(error)}`,
        );
      }

      if (!result.getTransactionResponse) {
        throw new BadRequestException('Transaction response not available');
      }

      const txHash = result.getTransactionResponse.txHash;

      // Delete from database
      await this.prisma.bounty.delete({
        where: { id: dbBountyId },
      });

      this.logger.log(`Bounty deleted: ${dbBountyId}, tx: ${txHash}`);

      return { message: 'Bounty deleted successfully' };
    } catch (error) {
      this.logger.error('Failed to delete bounty', error);
      throw error;
    }
  }

  /**
   * Apply to bounty
   */
  async applyToBounty(
    userId: string,
    dbBountyId: string,
    dto: ApplyToBountyDto,
  ): Promise<{ message: string; submission: BountySubmission }> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        include: { wallet: true },
      });

      if (!user || !user.wallet) {
        throw new NotFoundException('User or wallet not found');
      }

      if (user.role !== Role.CONTRIBUTOR) {
        throw new ForbiddenException('Only contributors can apply to bounties');
      }

      // Validate wallet has sufficient XLM for transaction
      await validateWalletForTransaction(
        user.wallet.publicKey,
        this.configService.getOrThrow<string>(EnvConfig.SOROBAN_HORIZON_URL),
      );

      // Get bounty to validate submission fields
      const bounty = await this.prisma.bounty.findUnique({
        where: { id: dbBountyId },
      });

      if (!bounty || bounty.contractBountyId === null) {
        throw new NotFoundException('Bounty not found');
      }

      const contractBountyId = bounty.contractBountyId;

      // Validate submission data against bounty's submission fields
      const submissionFields = bounty.submissionFields as unknown as
        | SubmissionField[]
        | undefined;
      validateSubmissionData(dto.submissionData, submissionFields);

      // Hash the submission link before sending to smart contract
      const hashedLink = createHash('sha256')
        .update(dto.submissionLink)
        .digest('hex');

      // Set the public key for the Soroban client
      this.sorobanClient.options.publicKey = user.wallet.publicKey;

      const tx = await this.sorobanClient.apply_to_bounty({
        applicant: user.wallet.publicKey,
        bounty_id: contractBountyId,
        submission_link: hashedLink,
      });

      // Sign and send transaction
      const result = await tx.signAndSend({
        signTransaction: async (transactionXdr) => {
          const transaction = StellarSDK.TransactionBuilder.fromXDR(
            transactionXdr,
            this.networkPassphrase,
          ) as StellarSDK.Transaction;

          const signedTx = await this.walletSigning.signTransaction(
            user.wallet!.id,
            transaction,
          );

          return {
            signedTxXdr: signedTx.toXDR(),
            signerAddress: user.wallet!.publicKey,
          };
        },
      });

      // Handle transaction result
      if (!result.result.isOk()) {
        const error = result.result.unwrapErr();
        this.logger.error('Contract invocation failed', error);
        throw new BadRequestException(
          `Failed to apply to bounty on contract: ${JSON.stringify(error)}`,
        );
      }

      if (!result.getTransactionResponse) {
        throw new BadRequestException('Transaction response not available');
      }

      const txHash = result.getTransactionResponse.txHash;

      // Create submission in database with validated data
      const submission = await this.prisma.bountySubmission.create({
        data: {
          bountyId: bounty.id,
          userId,
          submissionLink: dto.submissionLink,
          submission: dto.submissionData || {},
        },
      });

      // Award reputation for bounty submission
      try {
        await this.reputationService.addReputation(
          userId,
          'BOUNTY_SUBMISSION',
          {
            bountyId: bounty.id,
            bountyTitle: bounty.title,
          },
        );
      } catch (error) {
        this.logger.error(
          'Failed to add reputation for bounty submission',
          error,
        );
      }

      this.logger.log(
        `User ${userId} applied to bounty ${dbBountyId}, tx: ${txHash}`,
      );

      return {
        message: 'Application submitted successfully',
        submission,
      };
    } catch (error) {
      this.logger.error('Failed to apply to bounty', error);
      throw error;
    }
  }

  /**
   * Update submission
   */
  async updateSubmission(
    userId: string,
    dbBountyId: string,
    dto: UpdateBountyApplicationDto,
  ): Promise<{ message: string; submission: BountySubmission }> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        include: { wallet: true },
      });

      if (!user || !user.wallet) {
        throw new NotFoundException('User or wallet not found');
      }

      // Validate wallet has sufficient XLM for transaction
      await validateWalletForTransaction(
        user.wallet.publicKey,
        this.configService.getOrThrow<string>(EnvConfig.SOROBAN_HORIZON_URL),
      );

      // Get bounty to validate submission fields
      const bounty = await this.prisma.bounty.findUnique({
        where: { id: dbBountyId },
      });

      if (!bounty || bounty.contractBountyId === null) {
        throw new NotFoundException('Bounty not found');
      }

      if (new Date() > bounty.submissionDeadline) {
        throw new BadRequestException('Submission deadline has passed');
      }

      const contractBountyId = bounty.contractBountyId;

      // Validate submission data against bounty's submission fields
      const submissionFields = bounty.submissionFields as unknown as
        | SubmissionField[]
        | undefined;
      validateSubmissionData(dto.submissionData, submissionFields);

      const existingSubmission = await this.prisma.bountySubmission.findFirst({
        where: {
          bountyId: bounty.id,
          userId,
        },
      });
      if (!existingSubmission) {
        throw new NotFoundException('Submission not found');
      }

      if (dto.submissionLink) {
        let txHash: string | undefined;

        // Hash the new submission link
        const hashedLink = createHash('sha256')
          .update(dto.submissionLink)
          .digest('hex');

        // Hash the existing submission link for comparison
        const existingHashedLink = existingSubmission?.submissionLink
          ? createHash('sha256')
              .update(existingSubmission.submissionLink)
              .digest('hex')
          : undefined;

        // Only update on-chain if submission link changed
        if (dto.submissionLink && existingHashedLink !== hashedLink) {
          // Set the public key for the Soroban client
          this.sorobanClient.options.publicKey = user.wallet.publicKey;

          const tx = await this.sorobanClient.update_submission({
            applicant: user.wallet.publicKey,
            bounty_id: contractBountyId,
            new_submission_link: hashedLink,
          });

          // Sign and send transaction
          const result = await tx.signAndSend({
            signTransaction: async (transactionXdr) => {
              const transaction = StellarSDK.TransactionBuilder.fromXDR(
                transactionXdr,
                this.networkPassphrase,
              ) as StellarSDK.Transaction;

              const signedTx = await this.walletSigning.signTransaction(
                user.wallet!.id,
                transaction,
              );

              return {
                signedTxXdr: signedTx.toXDR(),
                signerAddress: user.wallet!.publicKey,
              };
            },
          });

          // Handle transaction result
          if (!result.result.isOk()) {
            const error = result.result.unwrapErr();
            this.logger.error('Contract invocation failed', error);
            throw new BadRequestException(
              `Failed to update submission on contract: ${JSON.stringify(error)}`,
            );
          }

          if (!result.getTransactionResponse) {
            throw new BadRequestException('Transaction response not available');
          }

          txHash = result.getTransactionResponse.txHash;

          this.logger.log(
            `User ${userId} updated submission link for bounty ${dbBountyId}, tx: ${txHash}`,
          );
        }
      }

      // Update submission in database with validated data
      const updatedSubmission = await this.prisma.bountySubmission.update({
        where: {
          bountyId_userId: {
            bountyId: bounty.id,
            userId,
          },
        },
        data: {
          submissionLink:
            dto.submissionLink || existingSubmission.submissionLink,
          submission:
            dto.submissionData ||
            (existingSubmission.submission as Prisma.InputJsonValue),
        },
      });

      this.logger.log(
        `User ${userId} updated submission for bounty ${dbBountyId}`,
      );

      return {
        message: 'Submission updated successfully',
        submission: updatedSubmission,
      };
    } catch (error) {
      this.logger.error('Failed to update submission', error);
      throw error;
    }
  }

  /**
   * Select winners
   */
  async selectWinners(
    userId: string,
    dbBountyId: string,
    dto: SelectWinnersDto,
  ): Promise<SelectWinnersResponseDto> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        include: { wallet: true },
      });

      if (!user || !user.wallet) {
        throw new NotFoundException('User or wallet not found');
      }

      // Validate wallet has sufficient XLM for transaction
      await validateWalletForTransaction(
        user.wallet.publicKey,
        this.configService.getOrThrow<string>(EnvConfig.SOROBAN_HORIZON_URL),
      );

      // Verify user owns the bounty
      const bounty = await this.getBounty(dbBountyId);
      if (bounty.ownerId !== user.id) {
        throw new ForbiddenException('You do not own this bounty');
      }

      if (new Date() < bounty.submissionDeadline) {
        throw new BadRequestException(
          'Cannot select winners before submission deadline',
        );
      }

      const contractBountyId = bounty.contractBountyId;

      // Fetch winner users and their public keys
      const winnerUsers = await this.prisma.user.findMany({
        where: {
          id: { in: dto.winners },
        },
        include: { wallet: true },
      });

      // Validate all winners have wallets
      const missingWallets = dto.winners.filter(
        (winnerId) => !winnerUsers.find((u) => u.id === winnerId)?.wallet,
      );

      if (missingWallets.length > 0) {
        throw new BadRequestException(
          `Winners with IDs ${missingWallets.join(', ')} do not have wallets`,
        );
      }

      // Get bounty currency for trustline validation
      const bountyForTrustline = await this.prisma.bounty.findUnique({
        where: { id: dbBountyId },
      });
      const rewardCurrency = bountyForTrustline!.rewardCurrency || 'XLM';

      // Ensure all winners have trustlines for the reward currency
      this.logger.log(
        `Checking and setting up trustlines for winners for currency: ${rewardCurrency}`,
      );

      for (const winner of winnerUsers) {
        if (!winner.wallet) continue;

        try {
          const result = await ensureTrustline(
            winner.wallet.id,
            winner.wallet.publicKey,
            rewardCurrency,
            this.networkPassphrase,
            this.stellarAccount.getServer(),
            this.walletSigning,
            this.stellarWallet,
            this.configService.get<string>(EnvConfig.FUNDING_WALLET_ID), // Optional funding wallet for account activation
          );

          if (result.exists) {
            this.logger.log(
              `Winner ${winner.id} already has trustline for ${rewardCurrency}`,
            );
          } else {
            const fundingMsg = result.funded
              ? ` (account funded with ${result.fundingTxHash})`
              : '';
            this.logger.log(
              `Trustline established for winner ${winner.id} for ${rewardCurrency}: ${result.txHash}${fundingMsg}`,
            );
          }
        } catch (error) {
          this.logger.error(
            `Failed to ensure trustline for winner ${winner.id}`,
            error,
          );
          throw new BadRequestException(
            `Failed to setup trustline for winner ${winner.username || winner.id}. ${error instanceof Error ? error.message : 'Please ask them to manually setup a trustline for ' + rewardCurrency + '.'}`,
          );
        }
      }

      // Extract public keys in the same order as winner IDs
      const winnerPublicKeys = dto.winners.map((winnerId) => {
        const winner = winnerUsers.find((u) => u.id === winnerId);
        return winner!.wallet!.publicKey;
      });

      // Set the public key for the Soroban client
      this.sorobanClient.options.publicKey = user.wallet.publicKey;

      const tx = await this.sorobanClient.select_winners({
        owner: user.wallet.publicKey,
        bounty_id: contractBountyId,
        winners: winnerPublicKeys,
      });

      // Sign and send transaction (Payouts are handled by the Soroban contract)
      const result = await tx.signAndSend({
        signTransaction: async (transactionXdr) => {
          const transaction = StellarSDK.TransactionBuilder.fromXDR(
            transactionXdr,
            this.networkPassphrase,
          ) as StellarSDK.Transaction;

          const signedTx = await this.walletSigning.signTransaction(
            user.wallet!.id,
            transaction,
          );

          return {
            signedTxXdr: signedTx.toXDR(),
            signerAddress: user.wallet!.publicKey,
          };
        },
      });

      // Handle transaction result
      if (!result.result.isOk()) {
        const error = result.result.unwrapErr();
        this.logger.error('Contract invocation failed', error);
        throw new BadRequestException(
          `Failed to select winners on contract: ${JSON.stringify(error)}`,
        );
      }

      if (!result.getTransactionResponse) {
        throw new BadRequestException('Transaction response not available');
      }

      const txHash = result.getTransactionResponse.txHash;

      // Update bounty status in database
      await this.prisma.bounty.update({
        where: { id: dbBountyId },
        data: { status: BountyStatus.COMPLETED },
      });

      // Fetch bounty details for queue job
      const dbBounty = await this.prisma.bounty.findUnique({
        where: { id: dbBountyId },
      });

      // Parse reward distribution (array format: [{rank: 1, percentage: 70}, ...])
      const rewardDistribution = dbBounty!.rewardDistribution as Array<{
        rank: number;
        percentage: number;
      }>;
      const totalReward = Number(dbBounty!.reward);
      const currency = dbBounty!.rewardCurrency || 'XLM';

      // Prepare winner data for queue
      const winners = dto.winners.map((winnerId, index) => {
        const position = index + 1;
        const distributionEntry = rewardDistribution.find(
          (d) => d.rank === position,
        );
        const percentage = distributionEntry?.percentage || 0;
        const payoutAmount = (totalReward * percentage) / 100;

        return {
          userId: winnerId,
          position,
          payoutAmount,
        };
      });

      // Dispatch winner processing to queue
      await this.bountyWinnerQueue.add(
        'process-winners',
        {
          bountyId: dbBounty!.id,
          winners,
          bountyTitle: dbBounty!.title,
          currency,
          totalReward,
        },
        {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
        },
      );

      this.logger.log(
        `Dispatched winner processing to queue for bounty ${dbBountyId}`,
      );

      this.logger.log(
        `Winners selected for bounty ${dbBountyId}, tx: ${txHash}`,
      );

      // Build detailed winner response
      const detailedWinners = dto.winners.map((winnerId, index) => {
        const position = index + 1;
        const distributionEntry = rewardDistribution.find(
          (d) => d.rank === position,
        );
        const percentage = distributionEntry?.percentage || 0;
        const amountWon = (totalReward * percentage) / 100;
        const winner = winnerUsers.find((u) => u.id === winnerId);

        return {
          userId: winnerId,
          username: winner!.username,
          firstName: winner!.firstName,
          lastName: winner!.lastName,
          profilePicture: winner!.profilePicture || undefined,
          publicKey: winner!.wallet!.publicKey,
          position,
          amountWon,
          currency,
          percentage,
          awardedAt: new Date(),
        };
      });

      return {
        message: 'Winners selected successfully',
        transactionHash: txHash,
        winners: detailedWinners,
        totalReward,
        currency,
        bountyTitle: dbBounty!.title,
        bountyId: dbBounty!.id,
      };
    } catch (error) {
      this.logger.error('Failed to select winners', error);
      throw error;
    }
  }

  /**
   * Close a bounty
   * Can only be done by the owner before any submissions are made
   */
  async closeBounty(
    userId: string,
    dbBountyId: string,
  ): Promise<{ message: string; bounty: Bounty }> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        include: { wallet: true },
      });

      if (!user || !user.wallet) {
        throw new NotFoundException('User or wallet not found');
      }

      // Validate wallet has sufficient XLM for transaction
      await validateWalletForTransaction(
        user.wallet.publicKey,
        this.configService.getOrThrow<string>(EnvConfig.SOROBAN_HORIZON_URL),
      );

      // Verify user owns the bounty
      const bounty = await this.getBounty(dbBountyId);
      if (bounty.ownerId !== user.id) {
        throw new ForbiddenException('You do not own this bounty');
      }

      const contractBountyId = bounty.contractBountyId;

      // Check if bounty has any submissions
      const assembled = await this.sorobanClient.get_bounty_submissions({
        bounty_id: contractBountyId,
      });
      const simulated = await assembled.simulate();

      if (simulated.result.isOk()) {
        const submissionsMap = simulated.result.unwrap();
        if (submissionsMap.size > 0) {
          throw new ForbiddenException(
            'Cannot close bounty with existing submissions',
          );
        }
      }

      // Set the public key for the Soroban client
      this.sorobanClient.options.publicKey = user.wallet.publicKey;

      const tx = await this.sorobanClient.close_bounty({
        owner: user.wallet.publicKey,
        bounty_id: contractBountyId,
      });

      // Sign and send transaction
      const result = await tx.signAndSend({
        signTransaction: async (transactionXdr) => {
          const transaction = StellarSDK.TransactionBuilder.fromXDR(
            transactionXdr,
            this.networkPassphrase,
          ) as StellarSDK.Transaction;

          const signedTx = await this.walletSigning.signTransaction(
            user.wallet!.id,
            transaction,
          );

          return {
            signedTxXdr: signedTx.toXDR(),
            signerAddress: user.wallet!.publicKey,
          };
        },
      });

      // Handle transaction result
      if (!result.result.isOk()) {
        const error = result.result.unwrapErr();
        this.logger.error('Contract invocation failed', error);
        throw new BadRequestException(
          `Failed to close bounty on contract: ${JSON.stringify(error)}`,
        );
      }

      if (!result.getTransactionResponse) {
        throw new BadRequestException('Transaction response not available');
      }

      const txHash = result.getTransactionResponse.txHash;

      // Update bounty status in database
      const closedBounty = await this.prisma.bounty.update({
        where: { id: dbBountyId },
        data: { status: BountyStatus.CLOSED },
      });

      this.logger.log(`Bounty ${dbBountyId} closed by owner, tx: ${txHash}`);

      return { message: 'Bounty closed successfully', bounty: closedBounty };
    } catch (error) {
      this.logger.error('Failed to close bounty', error);
      throw error;
    }
  }

  /**
   * Get bounty submissions (from contract)
   */
  async getBountySubmissions(dbBountyId: string): Promise<Map<string, string>> {
    try {
      const bounty = await this.prisma.bounty.findUnique({
        where: { id: dbBountyId },
      });

      if (!bounty || bounty.contractBountyId === null) {
        throw new NotFoundException('Bounty not found');
      }

      const assembled = await this.sorobanClient.get_bounty_submissions({
        bounty_id: bounty.contractBountyId,
      });
      const simulated = await assembled.simulate();

      if (!simulated.result.isOk()) {
        throw new NotFoundException('Bounty not found');
      }

      return simulated.result.unwrap();
    } catch (error) {
      this.logger.error('Failed to get bounty submissions', error);
      throw error;
    }
  }

  /**
   * Get detailed bounty submissions from database
   * Includes submission data and user information
   */
  async getBountySubmissionsDetailed(dbBountyId: string) {
    try {
      const bounty = await this.prisma.bounty.findUnique({
        where: { id: dbBountyId },
      });

      if (!bounty) {
        throw new NotFoundException('Bounty not found');
      }

      const submissions = await this.prisma.bountySubmission.findMany({
        where: { bountyId: bounty.id },
        include: {
          user: {
            include: {
              wallet: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      return submissions.map((submission) => ({
        id: submission.id,
        submissionLink: submission.submissionLink,
        submissionData: submission.submission,
        status: submission.status,
        createdAt: submission.createdAt,
        updatedAt: submission.updatedAt,
        user: sanitizeUser(submission.user),
      }));
    } catch (error) {
      this.logger.error('Failed to get detailed bounty submissions', error);
      throw error;
    }
  }

  /**
   * Get bounty applicants
   */
  async getBountyApplicants(dbBountyId: string): Promise<string[]> {
    try {
      const bounty = await this.prisma.bounty.findUnique({
        where: { id: dbBountyId },
      });

      if (!bounty || bounty.contractBountyId === null) {
        throw new NotFoundException('Bounty not found');
      }

      const assembled = await this.sorobanClient.get_bounty_applicants({
        bounty_id: bounty.contractBountyId,
      });
      const simulated = await assembled.simulate();

      if (!simulated.result.isOk()) {
        throw new NotFoundException('Bounty not found');
      }

      return simulated.result.unwrap();
    } catch (error) {
      this.logger.error('Failed to get bounty applicants', error);
      throw error;
    }
  }

  /**
   * Get bounty winners
   */
  async getBountyWinners(
    dbBountyId: string,
  ): Promise<BountyWinnersResponseDto> {
    try {
      const bounty = await this.prisma.bounty.findUnique({
        where: { id: dbBountyId },
      });

      if (!bounty || bounty.contractBountyId === null) {
        throw new NotFoundException('Bounty not found');
      }

      if (bounty.status === BountyStatus.ACTIVE) {
        throw new ForbiddenException('Bounty is still active');
      }

      // Get winner records from database
      const dbWinners = await this.prisma.bountyWinner.findMany({
        where: { bountyId: dbBountyId },
        include: {
          user: {
            include: {
              wallet: true,
            },
          },
        },
        orderBy: { position: 'asc' },
      });

      if (dbWinners.length === 0) {
        throw new NotFoundException('No winners found for this bounty');
      }

      const rewardDistribution = bounty.rewardDistribution as Array<{
        rank: number;
        percentage: number;
      }>;
      const totalReward = Number(bounty.reward);
      const currency = bounty.rewardCurrency || 'XLM';

      // Build detailed winner response
      const winners = dbWinners.map((winner) => {
        const distributionEntry = rewardDistribution.find(
          (d) => d.rank === winner.position,
        );
        const percentage = distributionEntry?.percentage || 0;
        const amountWon = (totalReward * percentage) / 100;

        return {
          userId: winner.user.id,
          username: winner.user.username,
          firstName: winner.user.firstName,
          lastName: winner.user.lastName,
          profilePicture: winner.user.profilePicture || undefined,
          publicKey: winner.user.wallet?.publicKey || '',
          position: winner.position,
          amountWon,
          currency,
          percentage,
          awardedAt: winner.awardedAt,
        };
      });

      return {
        winners,
        totalReward,
        currency,
        bountyTitle: bounty.title,
        bountyId: bounty.id,
      };
    } catch (error) {
      this.logger.error('Failed to get bounty winners', error);
      throw error;
    }
  }

  /**
   * Get bounty status
   */
  async getBountyStatus(dbBountyId: string): Promise<Status> {
    try {
      const bounty = await this.prisma.bounty.findUnique({
        where: { id: dbBountyId },
      });

      if (!bounty || bounty.contractBountyId === null) {
        throw new NotFoundException('Bounty not found');
      }

      const assembled = await this.sorobanClient.get_bounty_status({
        bounty_id: bounty.contractBountyId,
      });
      const simulated = await assembled.simulate();

      if (!simulated.result.isOk()) {
        throw new NotFoundException('Bounty not found');
      }

      return simulated.result.unwrap();
    } catch (error) {
      this.logger.error('Failed to get bounty status', error);
      throw error;
    }
  }

  /**
   * Get supported currencies
   * Returns list of supported currencies with their token addresses for the current network
   */
  getSupportedCurrencies(): SupportedCurrency[] {
    return getSupportedCurrencies(this.networkPassphrase);
  }
}
