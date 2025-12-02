import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BountyStatus } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import type {
  Bounty as ContractBounty,
  Status,
} from '../soroban/contract-bindings';
import {
  Client as SorobanClient,
  networks,
} from '../soroban/contract-bindings';
import { StellarAccountService } from '../soroban/stellar-account.service';

export interface CreateBountyDto {
  title: string;
  description: string;
  reward: string; // Amount in stroops
  token: string; // Token contract address
  distribution: Array<{ rank: number; percentage: number }>;
  submissionDeadline: Date;
  judgingDeadline: Date;
}

export interface UpdateBountyDto {
  title?: string;
  distribution?: Array<{ rank: number; percentage: number }>;
  submissionDeadline?: Date;
}

export interface ApplyToBountyDto {
  submissionLink: string;
}

export interface SelectWinnersDto {
  winners: string[]; // Array of user public keys
}

/**
 * Bounty Service
 * Handles all bounty-related operations with Soroban smart contract
 */
@Injectable()
export class BountyService {
  private readonly logger = new Logger(BountyService.name);
  private sorobanClient: SorobanClient;
  private readonly contractId: string;

  constructor(
    private prisma: PrismaService,
    private stellarAccount: StellarAccountService,
    private configService: ConfigService,
  ) {
    this.contractId = this.configService.get<string>('SOROBAN_CONTRACT_ID')!;
    const network = this.configService.get<string>('SOROBAN_NETWORK')!;
    const rpcUrl = this.configService.get<string>('SOROBAN_RPC_URL')!;

    // Initialize Soroban client
    this.sorobanClient = new SorobanClient({
      contractId: this.contractId,
      networkPassphrase:
        networks[network as keyof typeof networks].networkPassphrase,
      rpcUrl,
    });
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

      // Get master account keypair for signing
      const masterKeypair = this.stellarAccount.getMasterKeypair();

      // Create bounty on contract
      const tx = await this.sorobanClient.create_bounty({
        owner: user.wallet.memoId, // Use wallet memo as owner identifier
        token: dto.token,
        reward: BigInt(dto.reward),
        distribution,
        submission_deadline: BigInt(
          Math.floor(dto.submissionDeadline.getTime() / 1000),
        ),
        judging_deadline: BigInt(
          Math.floor(dto.judgingDeadline.getTime() / 1000),
        ),
        title: dto.title,
      });

      // Sign and send transaction
      tx.sign(masterKeypair);
      const result = await tx.send();

      // Get bounty ID from result
      const bountyId = Number(result.result);

      // Store bounty in database
      await this.prisma.bounty.create({
        data: {
          title: dto.title,
          description: dto.description,
          reward: dto.reward,
          token: dto.token,
          submissionDeadline: dto.submissionDeadline,
          judgingDeadline: dto.judgingDeadline,
          ownerId: userId,
          contractBountyId: bountyId,
          status: 'ACTIVE',
        },
      });

      this.logger.log(`Bounty created: ${bountyId}, tx: ${result.hash}`);

      return {
        bountyId,
        txHash: result.hash,
      };
    } catch (error) {
      this.logger.error('Failed to create bounty', error);
      throw error;
    }
  }

  /**
   * Get all bounties
   */
  async getAllBounties(): Promise<number[]> {
    try {
      const tx = await this.sorobanClient.get_bounties();
      const result = await tx.simulate();
      return result.result.map(Number);
    } catch (error) {
      this.logger.error('Failed to get bounties', error);
      throw error;
    }
  }

  /**
   * Get bounties by owner
   */
  async getOwnerBounties(userId: string): Promise<number[]> {
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
      return result.result.map(Number);
    } catch (error) {
      this.logger.error('Failed to get owner bounties', error);
      throw error;
    }
  }

  /**
   * Get active bounties
   */
  async getActiveBounties(): Promise<number[]> {
    try {
      const tx = await this.sorobanClient.get_active_bounties();
      const result = await tx.simulate();
      return result.result.map(Number);
    } catch (error) {
      this.logger.error('Failed to get active bounties', error);
      throw error;
    }
  }

  /**
   * Get bounty details
   */
  async getBounty(bountyId: number): Promise<ContractBounty> {
    try {
      const tx = await this.sorobanClient.get_bounty({ bounty_id: bountyId });
      const result = await tx.simulate();

      if (!result.result.isOk()) {
        throw new NotFoundException('Bounty not found');
      }

      return result.result.unwrap();
    } catch (error) {
      this.logger.error('Failed to get bounty', error);
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
      if (bounty.owner !== user.wallet.memoId) {
        throw new ForbiddenException('You do not own this bounty');
      }

      // Prepare update parameters
      const distribution: Array<readonly [number, number]> = dto.distribution
        ? dto.distribution.map((d) => [d.rank, d.percentage] as const)
        : [];

      const masterKeypair = this.stellarAccount.getMasterKeypair();

      const tx = await this.sorobanClient.update_bounty({
        owner: user.wallet.memoId,
        bounty_id: bountyId,
        new_title: dto.title || null,
        new_distribution: distribution,
        new_submission_deadline: dto.submissionDeadline
          ? BigInt(Math.floor(dto.submissionDeadline.getTime() / 1000))
          : null,
      });

      tx.sign(masterKeypair);
      const result = await tx.send();

      // Update in database
      await this.prisma.bounty.update({
        where: { contractBountyId: bountyId },
        data: {
          ...(dto.title && { title: dto.title }),
          ...(dto.submissionDeadline && {
            submissionDeadline: dto.submissionDeadline,
          }),
        },
      });

      this.logger.log(`Bounty updated: ${bountyId}, tx: ${result.hash}`);

      return { txHash: result.hash };
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
      if (bounty.owner !== user.wallet.memoId) {
        throw new ForbiddenException('You do not own this bounty');
      }

      const masterKeypair = this.stellarAccount.getMasterKeypair();

      const tx = await this.sorobanClient.delete_bounty({
        owner: user.wallet.memoId,
        bounty_id: bountyId,
      });

      tx.sign(masterKeypair);
      const result = await tx.send();

      // Delete from database
      await this.prisma.bounty.delete({
        where: { contractBountyId: bountyId },
      });

      this.logger.log(`Bounty deleted: ${bountyId}, tx: ${result.hash}`);

      return { txHash: result.hash };
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

      const masterKeypair = this.stellarAccount.getMasterKeypair();

      const tx = await this.sorobanClient.apply_to_bounty({
        applicant: user.wallet.memoId,
        bounty_id: bountyId,
        submission_link: dto.submissionLink,
      });

      tx.sign(masterKeypair);
      const result = await tx.send();

      // Create submission in database
      await this.prisma.bountySubmission.create({
        data: {
          bountyId: (await this.prisma.bounty.findUnique({
            where: { contractBountyId: bountyId },
          }))!.id,
          userId,
          submissionLink: dto.submissionLink,
        },
      });

      this.logger.log(
        `User ${userId} applied to bounty ${bountyId}, tx: ${result.hash}`,
      );

      return { txHash: result.hash };
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

      const masterKeypair = this.stellarAccount.getMasterKeypair();

      const tx = await this.sorobanClient.update_submission({
        applicant: user.wallet.memoId,
        bounty_id: bountyId,
        new_submission_link: dto.submissionLink,
      });

      tx.sign(masterKeypair);
      const result = await tx.send();

      // Update submission in database
      const bounty = await this.prisma.bounty.findUnique({
        where: { contractBountyId: bountyId },
      });

      await this.prisma.bountySubmission.updateMany({
        where: {
          bountyId: bounty!.id,
          userId,
        },
        data: {
          submissionLink: dto.submissionLink,
        },
      });

      this.logger.log(
        `User ${userId} updated submission for bounty ${bountyId}, tx: ${result.hash}`,
      );

      return { txHash: result.hash };
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
      if (bounty.owner !== user.wallet.memoId) {
        throw new ForbiddenException('You do not own this bounty');
      }

      const masterKeypair = this.stellarAccount.getMasterKeypair();

      const tx = await this.sorobanClient.select_winners({
        owner: user.wallet.memoId,
        bounty_id: bountyId,
        winners: dto.winners,
      });

      tx.sign(masterKeypair);
      const result = await tx.send();

      // Update bounty status in database
      await this.prisma.bounty.update({
        where: { contractBountyId: bountyId },
        data: { status: BountyStatus.COMPLETED },
      });

      // Create winner records
      const dbBounty = await this.prisma.bounty.findUnique({
        where: { contractBountyId: bountyId },
      });

      for (const winnerMemoId of dto.winners) {
        // Find user by wallet memo
        const winner = await this.prisma.user.findFirst({
          where: { wallet: { memoId: winnerMemoId } },
        });

        if (winner) {
          await this.prisma.bountyWinner.create({
            data: {
              bountyId: dbBounty!.id,
              userId: winner.id,
              position: dto.winners.indexOf(winnerMemoId) + 1,
            },
          });
        }
      }

      this.logger.log(
        `Winners selected for bounty ${bountyId}, tx: ${result.hash}`,
      );

      return { txHash: result.hash };
    } catch (error) {
      this.logger.error('Failed to select winners', error);
      throw error;
    }
  }

  /**
   * Get bounty submissions
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
}
