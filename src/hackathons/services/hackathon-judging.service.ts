import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  HackathonStatus,
  HackathonSubmissionStatus,
  PayoutSourceType,
  PayoutStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { calculateUsdValue } from '../../common/utils/token-price.util';
import { ContributorFundingService } from '../../wallet/contributor-funding.service';
import { HackathonContractService } from './hackathon-contract.service';

@Injectable()
export class HackathonJudgingService {
  private readonly logger = new Logger(HackathonJudgingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly contractService: HackathonContractService,
    private readonly contributorFunding: ContributorFundingService,
  ) {}

  private async getHackathonAndVerifyCompany(
    hackathonId: string,
    companyId: string,
    isAdmin = false,
  ) {
    const hackathon = await this.prisma.hackathon.findUnique({
      where: { id: hackathonId },
      include: { createdBy: { include: { wallet: true } } },
    });

    if (!hackathon) {
      throw new NotFoundException('Hackathon not found');
    }

    // Admins can judge any hackathon. Everyone else must be its assigned Project Owner.
    if (!isAdmin && hackathon.companyId !== companyId) {
      throw new ForbiddenException('Only the assigned Project Owner can judge');
    }

    if (hackathon.status !== HackathonStatus.JUDGING) {
      throw new BadRequestException('Hackathon is not in the judging phase');
    }

    return hackathon;
  }

  async setInReview(
    hackathonId: string,
    companyId: string,
    submissionId: string,
    isAdmin = false,
  ) {
    await this.getHackathonAndVerifyCompany(hackathonId, companyId, isAdmin);

    const submission = await this.prisma.hackathonSubmission.findUnique({
      where: { id: submissionId },
    });

    if (!submission || submission.hackathonId !== hackathonId) {
      throw new NotFoundException('Submission not found in this hackathon');
    }

    if (submission.status === HackathonSubmissionStatus.WINNER) {
      throw new BadRequestException(
        'Cannot set a winner to in-review directly. Use remove-winner first.',
      );
    }

    this.logger.log(
      `Submission ${submissionId} set to IN_REVIEW for hackathon ${hackathonId}`,
    );
    return this.prisma.hackathonSubmission.update({
      where: { id: submissionId },
      data: { status: HackathonSubmissionStatus.IN_REVIEW },
    });
  }

  async selectWinner(
    hackathonId: string,
    companyId: string,
    submissionId: string,
    position: number,
    feedback?: string,
    isAdmin = false,
  ) {
    const hackathon = await this.getHackathonAndVerifyCompany(
      hackathonId,
      companyId,
      isAdmin,
    );

    // Verify position exists in prize pool
    const prizePool = hackathon.prizePool as any[];
    const prize = prizePool.find((p) => p.position === position);
    if (!prize) {
      throw new BadRequestException(
        `Position ${position} is not defined in the prize pool`,
      );
    }

    const submission = await this.prisma.hackathonSubmission.findUnique({
      where: { id: submissionId },
    });

    if (!submission || submission.hackathonId !== hackathonId) {
      throw new NotFoundException('Submission not found');
    }

    // Per-track prizes can only go to a submission entered in that track.
    if (prize.track && submission.track !== prize.track) {
      throw new BadRequestException(
        `This prize is for the "${prize.track}" track, but the submission is in ${submission.track ? `"${submission.track}"` : 'no track'}`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      // Check if another submission holds this position
      const existingWinner = await tx.hackathonWinner.findUnique({
        where: { hackathonId_position: { hackathonId, position } },
      });

      if (existingWinner) {
        // Demote existing winner
        await tx.hackathonSubmission.update({
          where: { id: existingWinner.submissionId },
          data: { status: HackathonSubmissionStatus.IN_REVIEW },
        });
        await tx.hackathonWinner.delete({
          where: { id: existingWinner.id },
        });
      }

      // If this submission was another position winner, remove it from there
      if (submission.status === HackathonSubmissionStatus.WINNER) {
        await tx.hackathonWinner.deleteMany({
          where: { submissionId, hackathonId },
        });
      }

      // Mark new winner
      const updatedSubmission = await tx.hackathonSubmission.update({
        where: { id: submissionId },
        data: { status: HackathonSubmissionStatus.WINNER, feedback },
      });

      await tx.hackathonWinner.create({
        data: {
          position,
          prizeAmount: prize.amount,
          feedback,
          userId: submission.userId,
          hackathonId,
          submissionId,
        },
      });

      this.logger.log(
        `Submission ${submissionId} selected as winner (position ${position}) for hackathon ${hackathonId}`,
      );
      return updatedSubmission;
    });
  }

  async removeWinner(
    hackathonId: string,
    companyId: string,
    submissionId: string,
    isAdmin = false,
  ) {
    await this.getHackathonAndVerifyCompany(hackathonId, companyId, isAdmin);

    const submission = await this.prisma.hackathonSubmission.findUnique({
      where: { id: submissionId },
    });

    if (!submission || submission.hackathonId !== hackathonId) {
      throw new NotFoundException('Submission not found');
    }

    if (submission.status !== HackathonSubmissionStatus.WINNER) {
      throw new BadRequestException('Submission is not currently a winner');
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.hackathonWinner.deleteMany({
        where: { submissionId, hackathonId },
      });

      this.logger.log(
        `Winner status removed from submission ${submissionId} in hackathon ${hackathonId}`,
      );
      return tx.hackathonSubmission.update({
        where: { id: submissionId },
        data: { status: HackathonSubmissionStatus.IN_REVIEW, feedback: null },
      });
    });
  }

  async publishResults(
    hackathonId: string,
    companyId: string,
    isAdmin = false,
  ) {
    const hackathon = await this.getHackathonAndVerifyCompany(
      hackathonId,
      companyId,
      isAdmin,
    );

    const prizePool = hackathon.prizePool as any[];
    const winners = await this.prisma.hackathonWinner.findMany({
      where: { hackathonId },
      include: { user: { include: { wallet: true } } },
    });

    if (winners.length !== prizePool.length) {
      throw new BadRequestException(
        'All positions in the prize pool must be filled before publishing',
      );
    }

    // Call smart contract to distribute prizes
    const adminWallet = hackathon.createdBy.wallet;
    if (!adminWallet) {
      throw new BadRequestException(
        'Admin wallet not found for contract execution',
      );
    }

    let distributeTxHash: string | undefined;

    if (hackathon.contractHackathonId !== null) {
      const contractWinners = winners.map((w) => ({
        position: w.position,
        winnerAddress: w.user.wallet?.publicKey,
      }));

      // Validate all winners have a wallet configured
      for (const w of contractWinners) {
        if (!w.winnerAddress) {
          throw new BadRequestException(
            `Winner at position ${w.position} does not have an active wallet`,
          );
        }
      }

      // Ensure every winner's account can receive the prize (activated +
      // trustline for the hackathon currency) before the single distribute
      // call, otherwise the whole on-chain distribution would fail. Recipients
      // that need XLM are funded in one batched transaction.
      await this.contributorFunding.ensurePayoutRecipientsReady(
        winners
          .filter((winner) => winner.user.wallet)
          .map((winner) => ({
            walletId: winner.user.wallet!.id,
            publicKey: winner.user.wallet!.publicKey,
            currency: hackathon.currency,
          })),
      );

      const distributeResult = await this.contractService.distributePrizes({
        adminPublicKey: adminWallet.publicKey,
        adminWalletId: adminWallet.id,
        contractHackathonId: hackathon.contractHackathonId,
        winners: contractWinners as any,
      });
      distributeTxHash = distributeResult.txHash;
    }

    this.logger.log(`Results published for hackathon ${hackathonId}`);

    // Create Payout records for each winner
    const now = new Date();
    await Promise.all(
      winners.map(async (winner) => {
        const usdValue = await calculateUsdValue(
          winner.prizeAmount.toString(),
          hackathon.currency,
        );

        await this.prisma.payout.upsert({
          where: {
            sourceType_sourceId: {
              sourceType: PayoutSourceType.HACKATHON_WIN,
              sourceId: winner.id,
            },
          },
          create: {
            sourceType: PayoutSourceType.HACKATHON_WIN,
            sourceId: winner.id,
            token: hackathon.currency,
            amount: winner.prizeAmount,
            usdAmount: usdValue,
            status: PayoutStatus.COMPLETED,
            requestedAt: winner.createdAt,
            completedAt: now,
            txHash: distributeTxHash,
            contributorId: winner.userId,
            hackathonId: hackathon.id,
            hackathonWinnerId: winner.id,
            metadata: {
              position: winner.position,
              submissionId: winner.submissionId,
              source: 'hackathon-judging-service',
            } as Prisma.InputJsonValue,
          },
          update: {
            token: hackathon.currency,
            amount: winner.prizeAmount,
            usdAmount: usdValue,
            status: PayoutStatus.COMPLETED,
            completedAt: now,
            txHash: distributeTxHash,
            contributorId: winner.userId,
            hackathonId: hackathon.id,
            hackathonWinnerId: winner.id,
            metadata: {
              position: winner.position,
              submissionId: winner.submissionId,
              source: 'hackathon-judging-service',
            } as Prisma.InputJsonValue,
          },
        });

        // Also update the HackathonWinner record to keep it in sync
        await this.prisma.hackathonWinner.update({
          where: { id: winner.id },
          data: {
            isPaid: true,
            paidAt: now,
            txHash: distributeTxHash,
          },
        });
      }),
    );

    // Mark as completed and published
    return this.prisma.hackathon.update({
      where: { id: hackathonId },
      data: {
        status: HackathonStatus.COMPLETED,
        resultsPublished: true,
      },
    });
  }
}
