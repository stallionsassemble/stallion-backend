import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  HackathonPayoutMode,
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

    let distributeTxHash: string | undefined;

    // CONTRACT hackathons pay out on-chain now. MANUAL ones (and any without a
    // contract record) only get pending payouts that an admin marks paid later.
    if (
      hackathon.payoutMode === HackathonPayoutMode.CONTRACT &&
      hackathon.contractHackathonId !== null
    ) {
      const adminWallet = hackathon.createdBy.wallet;
      if (!adminWallet) {
        throw new BadRequestException(
          'Admin wallet not found for contract execution',
        );
      }

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
    const paidOnChain = distributeTxHash !== undefined;
    const payoutStatus = paidOnChain
      ? PayoutStatus.COMPLETED
      : PayoutStatus.PENDING_APPROVAL;
    const completedAt = paidOnChain ? now : null;
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
            status: payoutStatus,
            requestedAt: winner.createdAt,
            completedAt,
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
            status: payoutStatus,
            completedAt,
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
        if (paidOnChain) {
          await this.prisma.hackathonWinner.update({
            where: { id: winner.id },
            data: {
              isPaid: true,
              paidAt: now,
              txHash: distributeTxHash,
            },
          });
        }
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

  /**
   * Winners with where to pay them and payout status, for admins settling a MANUAL hackathon.
   */
  async listWinnersForPayout(hackathonId: string) {
    const hackathon = await this.prisma.hackathon.findUnique({
      where: { id: hackathonId },
      select: {
        id: true,
        payoutMode: true,
        currency: true,
        resultsPublished: true,
      },
    });
    if (!hackathon) {
      throw new NotFoundException('Hackathon not found');
    }

    const winners = await this.prisma.hackathonWinner.findMany({
      where: { hackathonId },
      orderBy: { position: 'asc' },
      include: {
        payout: {
          select: { id: true, status: true, txHash: true, metadata: true },
        },
        submission: { select: { id: true, track: true } },
        user: {
          select: {
            id: true,
            username: true,
            email: true,
            wallet: { select: { publicKey: true } },
            payoutMethods: {
              select: { name: true, publicKey: true, isDefault: true },
            },
          },
        },
      },
    });

    return { hackathon, winners };
  }

  /**
   * Record that a winner of a MANUAL hackathon was paid outside the platform.
   * Admin only; the payout created on publish moves from PENDING_APPROVAL to COMPLETED.
   */
  async markWinnerPaid(
    hackathonId: string,
    winnerId: string,
    adminId: string,
    txHash?: string,
    note?: string,
  ) {
    if (!txHash && !note) {
      throw new BadRequestException(
        'Provide the transaction hash or a payment reference',
      );
    }

    const winner = await this.prisma.hackathonWinner.findUnique({
      where: { id: winnerId },
      include: { hackathon: true, payout: true },
    });

    if (!winner || winner.hackathonId !== hackathonId) {
      throw new NotFoundException('Winner not found');
    }

    const { hackathon } = winner;
    if (
      hackathon.payoutMode === HackathonPayoutMode.CONTRACT &&
      hackathon.contractHackathonId !== null
    ) {
      throw new BadRequestException(
        'This hackathon pays winners through the contract',
      );
    }
    if (!hackathon.resultsPublished || !winner.payout) {
      throw new BadRequestException(
        'Publish the results before marking winners as paid',
      );
    }
    if (winner.isPaid) {
      throw new BadRequestException('This winner is already marked as paid');
    }

    const now = new Date();
    const usdValue = await calculateUsdValue(
      winner.prizeAmount.toString(),
      hackathon.currency,
    );
    const metadata = {
      ...((winner.payout.metadata as Prisma.JsonObject | null) ?? {}),
      manual: true,
      markedPaidBy: adminId,
      ...(note ? { paymentNote: note } : {}),
    } as Prisma.InputJsonValue;

    const payoutId = winner.payout.id;
    const updatedWinner = await this.prisma.$transaction(async (tx) => {
      // Conditional update so two admins marking the same winner can't both succeed.
      const { count } = await tx.hackathonWinner.updateMany({
        where: { id: winner.id, isPaid: false },
        data: {
          isPaid: true,
          paidAt: now,
          txHash: txHash ?? null,
          usdValueAtCompletion: usdValue,
        },
      });
      if (count === 0) {
        throw new BadRequestException('This winner is already marked as paid');
      }

      await tx.payout.update({
        where: { id: payoutId },
        data: {
          status: PayoutStatus.COMPLETED,
          completedAt: now,
          txHash: txHash ?? null,
          usdAmount: usdValue,
          metadata,
        },
      });

      return tx.hackathonWinner.findUniqueOrThrow({
        where: { id: winner.id },
      });
    });

    this.logger.log(
      `Hackathon ${hackathonId} winner ${winnerId} marked paid by admin ${adminId}${txHash ? ` (tx ${txHash})` : ''}`,
    );
    return updatedWinner;
  }
}
