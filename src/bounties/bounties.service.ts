import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BountyStatus, Prisma, type Bounty } from '@prisma/client';
import * as StellarSDK from '@stellar/stellar-sdk';
import { SanitizedUser, sanitizeUser } from 'src/common/utils/user.util';
import { PrismaService } from '../common/prisma/prisma.service';
import type { Status } from '../soroban/contract-bindings';
import {
  networks,
  Client as SorobanClient,
} from '../soroban/contract-bindings';
import { StellarAccountService } from '../soroban/stellar-account.service';
import { WalletService } from '../wallet/wallet.service';
import { ApplyToBountyDto } from './dto/apply-to-bounty.dto';
import { CreateBountyDto } from './dto/create-bounty.dto';
import { SelectWinnersDto } from './dto/select-winners.dto';
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

/**
 * Bounty Service
 * Handles all bounty-related operations with Soroban smart contract
 */
@Injectable()
export class BountiesService {
  private readonly logger = new Logger(BountiesService.name);
  private sorobanClient: SorobanClient;
  private rpcServer: StellarSDK.rpc.Server;
  private readonly contractId: string;
  private readonly networkPassphrase: string;

  constructor(
    private prisma: PrismaService,
    private stellarAccount: StellarAccountService,
    private configService: ConfigService,
    private walletService: WalletService,
  ) {
    this.contractId = this.configService.get<string>('SOROBAN_CONTRACT_ID')!;
    const network = this.configService.get<string>('SOROBAN_NETWORK')!;
    const rpcUrl = this.configService.get<string>('SOROBAN_RPC_URL')!;

    // Initialize Soroban RPC server
    this.rpcServer = new StellarSDK.rpc.Server(rpcUrl);
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
      const tx = await this.sorobanClient.get_bounties();
      const result = await tx.simulate();
      const contractBountyIds = result.result.map(Number);

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

      const tx = await this.sorobanClient.get_owner_bounties({
        owner: user.wallet.memoId,
      });

      const result = await tx.simulate();
      const contractBountyIds = result.result.map(Number);

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
      const tx = await this.sorobanClient.get_active_bounties();
      const result = await tx.simulate();
      const contractBountyIds = result.result.map(Number);

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
    bountyId: number,
  ): Promise<Bounty & { ownerDetails: SanitizedUser }> {
    try {
      const tx = await this.sorobanClient.get_bounty({ bounty_id: bountyId });
      const result = await tx.simulate();

      if (!result.result.isOk()) {
        throw new NotFoundException('Bounty not found');
      }

      const contractBounty = result.result.unwrap();

      // Fetch database bounty details
      const dbBounty = await this.prisma.bounty.findUnique({
        where: { contractBountyId: bountyId },
        include: {
          owner: true,
        },
      });

      if (!dbBounty) {
        throw new NotFoundException('Bounty not found');
      }

      // Convert contract status to database status
      let status: BountyStatus = BountyStatus.ACTIVE;
      if (contractBounty.status.tag === 'Active') {
        status = BountyStatus.ACTIVE;
      } else if (contractBounty.status.tag === 'Completed') {
        status = BountyStatus.COMPLETED;
      } else if (contractBounty.status.tag === 'Closed') {
        status = BountyStatus.CLOSED;
      }

      // Convert distribution Map to JSON object
      const distributionObj: Record<number, number> = {};
      contractBounty.distribution.forEach((value, key) => {
        distributionObj[key] = value;
      });

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
        rewardDistribution: distributionObj,
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
   * User must send funds to master account before calling this
   */
  async createBounty(
    userId: string,
    dto: CreateBountyDto,
  ): Promise<{ bountyId: number; txHash: string }> {
    try {
      // Get user from database
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        include: { wallet: true },
      });

      if (!user || !user.wallet) {
        throw new NotFoundException('User or wallet not found');
      }

      // Get token address from currency
      const tokenAddress = getTokenAddress(dto.rewardCurrency);

      // Calculate total amount needed (reward + 5% fee)
      const rewardAmount = BigInt(dto.reward);
      const feeAmount = (rewardAmount * BigInt(5)) / BigInt(100);
      const totalAmount = rewardAmount + feeAmount;

      // Verify user has sent funds to master account
      const paymentTxHash = await this.stellarAccount.verifyPaymentReceived(
        user.wallet.memoId,
        totalAmount.toString(),
      );

      if (!paymentTxHash) {
        throw new BadRequestException(
          `Please send ${totalAmount.toString()} stroops to master account with memo: ${user.wallet.memoId}`,
        );
      }

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

      // Create bounty on contract
      const tx = await this.sorobanClient.create_bounty({
        owner: user.wallet.memoId, // Use wallet memo as owner identifier
        token: tokenAddress,
        reward: rewardAmount,
        distribution,
        submission_deadline: BigInt(
          Math.floor(submissionDeadline.getTime() / 1000),
        ),
        judging_deadline: BigInt(Math.floor(judgingDeadline.getTime() / 1000)),
        title: dto.title,
      });

      // Prepare, sign with Vault and send transaction
      const preparedTx = await tx.simulate();
      const builtTx = StellarSDK.TransactionBuilder.fromXDR(
        preparedTx.toXDR(),
        this.networkPassphrase,
      ) as StellarSDK.Transaction;
      const signedTx =
        await this.stellarAccount.signTransactionWithVault(builtTx);

      const sendResponse = await this.rpcServer.sendTransaction(signedTx);

      // Poll for transaction result
      let getResponse = await this.rpcServer.getTransaction(sendResponse.hash);
      while (
        getResponse.status === StellarSDK.rpc.Api.GetTransactionStatus.NOT_FOUND
      ) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        getResponse = await this.rpcServer.getTransaction(sendResponse.hash);
      }

      if (
        getResponse.status !== StellarSDK.rpc.Api.GetTransactionStatus.SUCCESS
      ) {
        throw new Error('Transaction failed');
      }

      // Get bounty ID from result
      const bountyId = Number(getResponse.returnValue);

      // Store bounty in database
      await this.prisma.bounty.create({
        data: {
          title: dto.title,
          shortDescription: dto.shortDescription,
          description: dto.description,
          reward: dto.reward.toString(),
          token: tokenAddress,
          rewardCurrency: dto.rewardCurrency,
          rewardDistribution: dto.rewardDistribution,
          submissionFields:
            dto.submissionFields as unknown as Prisma.InputJsonValue,
          submissionDeadline,
          judgingDeadline,
          ownerId: userId,
          contractBountyId: bountyId,
          txHash: sendResponse.hash,
          status: 'ACTIVE',
        },
      });

      this.logger.log(`Bounty created: ${bountyId}, tx: ${sendResponse.hash}`);

      return {
        bountyId,
        txHash: sendResponse.hash,
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
    bountyId: number,
    dto: UpdateBountyDto,
  ): Promise<{ txHash: string }> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        include: { wallet: true },
      });

      if (!user || !user.wallet) {
        throw new NotFoundException('User or wallet not found');
      }

      // Verify user owns the bounty
      const bounty = await this.getBounty(bountyId);
      if (bounty.ownerId !== user.id) {
        throw new ForbiddenException('You do not own this bounty');
      }

      // Prepare update parameters
      const distribution: Array<readonly [number, number]> = dto.distribution
        ? dto.distribution.map((d) => [d.rank, d.percentage] as const)
        : [];

      const submissionDeadline = dto.submissionDeadline
        ? new Date(dto.submissionDeadline)
        : undefined;

      const tx = await this.sorobanClient.update_bounty({
        owner: user.wallet.memoId,
        bounty_id: bountyId,
        new_title: dto.title || undefined,
        new_distribution: distribution,
        new_submission_deadline: submissionDeadline
          ? BigInt(Math.floor(submissionDeadline.getTime() / 1000))
          : undefined,
      });

      // Prepare, sign with Vault and send transaction
      const preparedTx = await tx.simulate();
      const builtTx = StellarSDK.TransactionBuilder.fromXDR(
        preparedTx.toXDR(),
        this.networkPassphrase,
      ) as StellarSDK.Transaction;
      const signedTx =
        await this.stellarAccount.signTransactionWithVault(builtTx);

      const sendResponse = await this.rpcServer.sendTransaction(signedTx);

      // Update in database
      await this.prisma.bounty.update({
        where: { contractBountyId: bountyId },
        data: {
          ...(dto.title && { title: dto.title }),
          ...(submissionDeadline && {
            submissionDeadline,
          }),
        },
      });

      this.logger.log(`Bounty updated: ${bountyId}, tx: ${sendResponse.hash}`);

      return { txHash: sendResponse.hash };
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
    bountyId: number,
  ): Promise<{ txHash: string }> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        include: { wallet: true },
      });

      if (!user || !user.wallet) {
        throw new NotFoundException('User or wallet not found');
      }

      // Verify user owns the bounty
      const bounty = await this.getBounty(bountyId);
      if (bounty.ownerId !== user.id) {
        throw new ForbiddenException('You do not own this bounty');
      }

      const tx = await this.sorobanClient.delete_bounty({
        owner: user.wallet.memoId,
        bounty_id: bountyId,
      });

      // Prepare, sign with Vault and send transaction
      const preparedTx = await tx.simulate();
      const builtTx = StellarSDK.TransactionBuilder.fromXDR(
        preparedTx.toXDR(),
        this.networkPassphrase,
      ) as StellarSDK.Transaction;
      const signedTx =
        await this.stellarAccount.signTransactionWithVault(builtTx);

      const sendResponse = await this.rpcServer.sendTransaction(signedTx);

      // Delete from database
      await this.prisma.bounty.delete({
        where: { contractBountyId: bountyId },
      });

      this.logger.log(`Bounty deleted: ${bountyId}, tx: ${sendResponse.hash}`);

      return { txHash: sendResponse.hash };
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
    bountyId: number,
    dto: ApplyToBountyDto,
  ): Promise<{ txHash: string }> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        include: { wallet: true },
      });

      if (!user || !user.wallet) {
        throw new NotFoundException('User or wallet not found');
      }

      // Get bounty to validate submission fields
      const bounty = await this.prisma.bounty.findUnique({
        where: { contractBountyId: bountyId },
      });

      if (!bounty) {
        throw new NotFoundException('Bounty not found');
      }

      // Validate submission data against bounty's submission fields
      const submissionFields = bounty.submissionFields as unknown as
        | SubmissionField[]
        | undefined;
      validateSubmissionData(dto.submissionData, submissionFields);

      const tx = await this.sorobanClient.apply_to_bounty({
        applicant: user.wallet.memoId,
        bounty_id: bountyId,
        submission_link: dto.submissionLink,
      });

      // Prepare, sign with Vault and send transaction
      const preparedTx = await tx.simulate();
      const builtTx = StellarSDK.TransactionBuilder.fromXDR(
        preparedTx.toXDR(),
        this.networkPassphrase,
      ) as StellarSDK.Transaction;
      const signedTx =
        await this.stellarAccount.signTransactionWithVault(builtTx);

      const sendResponse = await this.rpcServer.sendTransaction(signedTx);

      // Create submission in database with validated data
      await this.prisma.bountySubmission.create({
        data: {
          bountyId: bounty.id,
          userId,
          submissionLink: dto.submissionLink,
          submission: dto.submissionData || {},
        },
      });

      this.logger.log(
        `User ${userId} applied to bounty ${bountyId}, tx: ${sendResponse.hash}`,
      );

      return { txHash: sendResponse.hash };
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
    bountyId: number,
    dto: ApplyToBountyDto,
  ): Promise<{ txHash: string }> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        include: { wallet: true },
      });

      if (!user || !user.wallet) {
        throw new NotFoundException('User or wallet not found');
      }

      // Get bounty to validate submission fields
      const bounty = await this.prisma.bounty.findUnique({
        where: { contractBountyId: bountyId },
      });

      if (!bounty) {
        throw new NotFoundException('Bounty not found');
      }

      // Validate submission data against bounty's submission fields
      const submissionFields = bounty.submissionFields as unknown as
        | SubmissionField[]
        | undefined;
      validateSubmissionData(dto.submissionData, submissionFields);

      // Get existing submission to check if link changed
      const existingSubmission = await this.prisma.bountySubmission.findFirst({
        where: {
          bountyId: bounty.id,
          userId,
        },
      });

      let txHash: string | undefined;

      // Only update on-chain if submission link changed
      if (
        dto.submissionLink &&
        existingSubmission?.submissionLink !== dto.submissionLink
      ) {
        const tx = await this.sorobanClient.update_submission({
          applicant: user.wallet.memoId,
          bounty_id: bountyId,
          new_submission_link: dto.submissionLink,
        });

        // Prepare, sign with Vault and send transaction
        const preparedTx = await tx.simulate();
        const builtTx = StellarSDK.TransactionBuilder.fromXDR(
          preparedTx.toXDR(),
          this.networkPassphrase,
        ) as StellarSDK.Transaction;
        const signedTx =
          await this.stellarAccount.signTransactionWithVault(builtTx);

        const sendResponse = await this.rpcServer.sendTransaction(signedTx);
        txHash = sendResponse.hash;

        this.logger.log(
          `User ${userId} updated submission link for bounty ${bountyId}, tx: ${txHash}`,
        );
      }

      // Update submission in database with validated data
      await this.prisma.bountySubmission.updateMany({
        where: {
          bountyId: bounty.id,
          userId,
        },
        data: {
          submissionLink: dto.submissionLink,
          submission: dto.submissionData || {},
        },
      });

      this.logger.log(
        `User ${userId} updated submission for bounty ${bountyId}`,
      );

      return { txHash: txHash || 'no-chain-update' };
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
    bountyId: number,
    dto: SelectWinnersDto,
  ): Promise<{ txHash: string }> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        include: { wallet: true },
      });

      if (!user || !user.wallet) {
        throw new NotFoundException('User or wallet not found');
      }

      // Verify user owns the bounty
      const bounty = await this.getBounty(bountyId);
      if (bounty.ownerId !== user.id) {
        throw new ForbiddenException('You do not own this bounty');
      }

      const tx = await this.sorobanClient.select_winners({
        owner: user.wallet.memoId,
        bounty_id: bountyId,
        winners: dto.winners,
      });

      // Prepare, sign with Vault and send transaction
      const preparedTx = await tx.simulate();
      const builtTx = StellarSDK.TransactionBuilder.fromXDR(
        preparedTx.toXDR(),
        this.networkPassphrase,
      ) as StellarSDK.Transaction;
      const signedTx =
        await this.stellarAccount.signTransactionWithVault(builtTx);

      const sendResponse = await this.rpcServer.sendTransaction(signedTx);

      // Update bounty status in database
      await this.prisma.bounty.update({
        where: { contractBountyId: bountyId },
        data: { status: BountyStatus.COMPLETED },
      });

      // Create winner records and process payouts
      const dbBounty = await this.prisma.bounty.findUnique({
        where: { contractBountyId: bountyId },
      });

      // Parse reward distribution
      const rewardDistribution = dbBounty!.rewardDistribution as Record<
        string,
        number
      >;
      const totalReward = Number(dbBounty!.reward);
      const currency = dbBounty!.rewardCurrency || 'XLM';

      for (const winnerMemoId of dto.winners) {
        // Find user by wallet memo
        const winner = await this.prisma.user.findFirst({
          where: { wallet: { memoId: winnerMemoId } },
          include: { wallet: true },
        });

        if (winner && winner.wallet) {
          const position = dto.winners.indexOf(winnerMemoId) + 1;

          // Create winner record
          await this.prisma.bountyWinner.create({
            data: {
              bountyId: dbBounty!.id,
              userId: winner.id,
              position,
              awardedAt: new Date(),
            },
          });

          // Calculate payout amount based on distribution
          const percentage = rewardDistribution[position.toString()] || 0;
          const payoutAmount = (totalReward * percentage) / 100;

          // Credit winner's wallet
          if (payoutAmount > 0) {
            await this.walletService.processPayout(
              winner.wallet.id,
              payoutAmount,
              currency,
              dbBounty!.id,
              position,
            );

            this.logger.log(
              `Credited ${payoutAmount} ${currency} to winner ${winner.id} (position ${position})`,
            );
          }
        }
      }

      this.logger.log(
        `Winners selected for bounty ${bountyId}, tx: ${sendResponse.hash}`,
      );

      return { txHash: sendResponse.hash };
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
    bountyId: number,
  ): Promise<{ txHash: string }> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        include: { wallet: true },
      });

      if (!user || !user.wallet) {
        throw new NotFoundException('User or wallet not found');
      }

      // Verify user owns the bounty
      const bounty = await this.getBounty(bountyId);
      if (bounty.ownerId !== user.id) {
        throw new ForbiddenException('You do not own this bounty');
      }

      // Check if bounty has any submissions
      const submissions = await this.sorobanClient.get_bounty_submissions({
        bounty_id: bountyId,
      });
      const submissionsResult = await submissions.simulate();

      if (submissionsResult.result.isOk()) {
        const submissionsMap = submissionsResult.result.unwrap();
        if (submissionsMap.size > 0) {
          throw new ForbiddenException(
            'Cannot close bounty with existing submissions',
          );
        }
      }

      const tx = await this.sorobanClient.close_bounty({
        owner: user.wallet.memoId,
        bounty_id: bountyId,
      });

      // Prepare, sign with Vault and send transaction
      const preparedTx = await tx.simulate();
      const builtTx = StellarSDK.TransactionBuilder.fromXDR(
        preparedTx.toXDR(),
        this.networkPassphrase,
      ) as StellarSDK.Transaction;
      const signedTx =
        await this.stellarAccount.signTransactionWithVault(builtTx);

      const sendResponse = await this.rpcServer.sendTransaction(signedTx);

      // Update bounty status in database
      await this.prisma.bounty.update({
        where: { contractBountyId: bountyId },
        data: { status: BountyStatus.CLOSED },
      });

      this.logger.log(
        `Bounty ${bountyId} closed by owner, tx: ${sendResponse.hash}`,
      );

      return { txHash: sendResponse.hash };
    } catch (error) {
      this.logger.error('Failed to close bounty', error);
      throw error;
    }
  }

  /**
   * Get bounty submissions (from contract)
   */
  async getBountySubmissions(bountyId: number): Promise<Map<string, string>> {
    try {
      const tx = await this.sorobanClient.get_bounty_submissions({
        bounty_id: bountyId,
      });

      const result = await tx.simulate();

      if (!result.result.isOk()) {
        throw new NotFoundException('Bounty not found');
      }

      return result.result.unwrap();
    } catch (error) {
      this.logger.error('Failed to get bounty submissions', error);
      throw error;
    }
  }

  /**
   * Get detailed bounty submissions from database
   * Includes submission data and user information
   */
  async getBountySubmissionsDetailed(bountyId: number) {
    try {
      const bounty = await this.prisma.bounty.findUnique({
        where: { contractBountyId: bountyId },
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
  async getBountyApplicants(bountyId: number): Promise<string[]> {
    try {
      const tx = await this.sorobanClient.get_bounty_applicants({
        bounty_id: bountyId,
      });

      const result = await tx.simulate();

      if (!result.result.isOk()) {
        throw new NotFoundException('Bounty not found');
      }

      return result.result.unwrap();
    } catch (error) {
      this.logger.error('Failed to get bounty applicants', error);
      throw error;
    }
  }

  /**
   * Get bounty winners
   */
  async getBountyWinners(bountyId: number): Promise<string[]> {
    try {
      const tx = await this.sorobanClient.get_bounty_winners({
        bounty_id: bountyId,
      });

      const result = await tx.simulate();

      if (!result.result.isOk()) {
        throw new NotFoundException('Bounty not found');
      }

      return result.result.unwrap();
    } catch (error) {
      this.logger.error('Failed to get bounty winners', error);
      throw error;
    }
  }

  /**
   * Get bounty status
   */
  async getBountyStatus(bountyId: number): Promise<Status> {
    try {
      const tx = await this.sorobanClient.get_bounty_status({
        bounty_id: bountyId,
      });

      const result = await tx.simulate();

      if (!result.result.isOk()) {
        throw new NotFoundException('Bounty not found');
      }

      return result.result.unwrap();
    } catch (error) {
      this.logger.error('Failed to get bounty status', error);
      throw error;
    }
  }

  /**
   * Get supported currencies
   * Returns list of supported currencies with their token addresses
   */
  getSupportedCurrencies(): SupportedCurrency[] {
    return getSupportedCurrencies();
  }
}
