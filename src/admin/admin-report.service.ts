import { BadRequestException, Injectable } from '@nestjs/common';
import { PayoutStatus, Prisma, Role } from '@prisma/client';
import { PrismaService } from 'src/common/prisma/prisma.service';

// Longest range one report may cover, and most rows returned per section.
const MAX_RANGE_DAYS = 2 * 366;
const MAX_ROWS = 5000;

const toNumber = (value: Prisma.Decimal | string | null | undefined) =>
  value === null || value === undefined ? null : Number(value);

const displayName = (
  user?: {
    firstName?: string | null;
    lastName?: string | null;
    username?: string | null;
    companyName?: string | null;
    email?: string | null;
  } | null,
) =>
  user
    ? user.companyName ||
      [user.firstName, user.lastName].filter(Boolean).join(' ') ||
      user.username ||
      user.email ||
      ''
    : '';

const ownerSelect = {
  firstName: true,
  lastName: true,
  username: true,
  companyName: true,
  email: true,
} as const;

/**
 * Platform activity for a date range, for the admin dashboard's report export:
 * a summary plus the users, bounties, projects, hackathons and payouts in the range.
 */
@Injectable()
export class AdminReportService {
  constructor(private readonly prisma: PrismaService) {}

  async getReport(fromIso: string, toIso: string) {
    return this.build(fromIso, toIso, MAX_ROWS);
  }

  /** Only the totals for the range, for the dashboard's period stats. */
  async getSummary(fromIso: string, toIso: string) {
    const { range, summary } = await this.build(fromIso, toIso, 0);
    return { range, summary };
  }

  private async build(fromIso: string, toIso: string, maxRows: number) {
    const from = new Date(fromIso);
    const to = new Date(toIso);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      throw new BadRequestException('from and to must be valid dates');
    }
    if (from >= to) {
      throw new BadRequestException('from must be before to');
    }
    if (to.getTime() - from.getTime() > MAX_RANGE_DAYS * 86_400_000) {
      throw new BadRequestException(
        `A report can cover at most ${MAX_RANGE_DAYS} days`,
      );
    }

    // `to` is exclusive, so a month runs from its 1st to the next month's 1st.
    const createdInRange = { createdAt: { gte: from, lt: to } };
    // A payout belongs to the range if it was requested or completed in it.
    const payoutWhere: Prisma.PayoutWhereInput = {
      OR: [
        { requestedAt: { gte: from, lt: to } },
        { completedAt: { gte: from, lt: to } },
      ],
    };

    const [users, bounties, projects, hackathons, payouts, totals] =
      await Promise.all([
        this.prisma.user.findMany({
          where: createdInRange,
          orderBy: { createdAt: 'asc' },
          take: maxRows,
          select: {
            id: true,
            firstName: true,
            lastName: true,
            username: true,
            email: true,
            companyName: true,
            role: true,
            status: true,
            country: true,
            createdAt: true,
          },
        }),
        this.prisma.bounty.findMany({
          where: createdInRange,
          orderBy: { createdAt: 'asc' },
          take: maxRows,
          select: {
            id: true,
            title: true,
            reward: true,
            rewardCurrency: true,
            status: true,
            createdAt: true,
            submissionDeadline: true,
            owner: { select: ownerSelect },
            _count: { select: { submissions: true, winners: true } },
          },
        }),
        this.prisma.project.findMany({
          where: createdInRange,
          orderBy: { createdAt: 'asc' },
          take: maxRows,
          select: {
            id: true,
            title: true,
            reward: true,
            status: true,
            peopleNeeded: true,
            acceptedCount: true,
            createdAt: true,
            owner: { select: ownerSelect },
            _count: { select: { applications: true } },
          },
        }),
        this.prisma.hackathon.findMany({
          where: createdInRange,
          orderBy: { createdAt: 'asc' },
          take: maxRows,
          select: {
            id: true,
            title: true,
            totalBudget: true,
            currency: true,
            payoutMode: true,
            status: true,
            deadline: true,
            createdAt: true,
            company: { select: ownerSelect },
            _count: { select: { participants: true, submissions: true } },
          },
        }),
        this.prisma.payout.findMany({
          where: payoutWhere,
          orderBy: { requestedAt: 'asc' },
          take: maxRows,
          select: {
            id: true,
            sourceType: true,
            amount: true,
            token: true,
            usdAmount: true,
            status: true,
            requestedAt: true,
            completedAt: true,
            txHash: true,
            contributor: { select: { username: true, email: true } },
            bounty: { select: { title: true } },
            project: { select: { title: true } },
            hackathon: { select: { title: true } },
          },
        }),
        // Counts over the whole range, so the summary stays right even if a section is capped.
        Promise.all([
          this.prisma.user.groupBy({
            by: ['role'],
            where: createdInRange,
            _count: { _all: true },
          }),
          this.prisma.bounty.count({ where: createdInRange }),
          this.prisma.project.count({ where: createdInRange }),
          this.prisma.hackathon.count({ where: createdInRange }),
          this.prisma.payout.count({ where: payoutWhere }),
          this.prisma.payout.aggregate({
            where: {
              status: PayoutStatus.COMPLETED,
              completedAt: { gte: from, lt: to },
            },
            _count: { _all: true },
            _sum: { usdAmount: true },
          }),
          this.prisma.payout.count({
            where: {
              status: {
                in: [PayoutStatus.PENDING_APPROVAL, PayoutStatus.PROCESSING],
              },
              requestedAt: { gte: from, lt: to },
            },
          }),
        ]),
      ]);

    const [
      usersByRole,
      bountyCount,
      projectCount,
      hackathonCount,
      payoutCount,
      completed,
      pendingPayouts,
    ] = totals;
    const roleCount = (role: Role) =>
      usersByRole.find((r) => r.role === role)?._count._all ?? 0;
    const newUsers = usersByRole.reduce((sum, r) => sum + r._count._all, 0);

    return {
      range: { from: from.toISOString(), to: to.toISOString() },
      summary: {
        newUsers,
        newContributors: roleCount(Role.CONTRIBUTOR),
        newProjectOwners: roleCount(Role.PROJECT_OWNER),
        bountiesCreated: bountyCount,
        projectsCreated: projectCount,
        hackathonsCreated: hackathonCount,
        payoutsCompleted: completed._count._all,
        payoutsCompletedUsd: toNumber(completed._sum.usdAmount) ?? 0,
        payoutsPending: pendingPayouts,
      },
      // True when a section hit MAX_ROWS and was cut short.
      truncated: {
        users: newUsers > users.length,
        bounties: bountyCount > bounties.length,
        projects: projectCount > projects.length,
        hackathons: hackathonCount > hackathons.length,
        payouts: payoutCount > payouts.length,
      },
      users: users.map((u) => ({
        id: u.id,
        name: [u.firstName, u.lastName].filter(Boolean).join(' '),
        username: u.username,
        email: u.email,
        companyName: u.companyName,
        role: u.role,
        status: u.status,
        country: u.country,
        joinedAt: u.createdAt,
      })),
      bounties: bounties.map((b) => ({
        id: b.id,
        title: b.title,
        owner: displayName(b.owner),
        reward: b.reward,
        currency: b.rewardCurrency,
        status: b.status,
        submissions: b._count.submissions,
        winners: b._count.winners,
        submissionDeadline: b.submissionDeadline,
        createdAt: b.createdAt,
      })),
      projects: projects.map((p) => ({
        id: p.id,
        title: p.title,
        owner: displayName(p.owner),
        reward: p.reward,
        status: p.status,
        peopleNeeded: p.peopleNeeded,
        accepted: p.acceptedCount,
        applications: p._count.applications,
        createdAt: p.createdAt,
      })),
      hackathons: hackathons.map((h) => ({
        id: h.id,
        title: h.title,
        host: displayName(h.company),
        budget: toNumber(h.totalBudget),
        currency: h.currency,
        payoutMode: h.payoutMode,
        status: h.status,
        participants: h._count.participants,
        submissions: h._count.submissions,
        deadline: h.deadline,
        createdAt: h.createdAt,
      })),
      payouts: payouts.map((p) => ({
        id: p.id,
        source: p.sourceType,
        sourceTitle:
          p.bounty?.title ?? p.project?.title ?? p.hackathon?.title ?? '',
        contributor: p.contributor.username || p.contributor.email,
        amount: toNumber(p.amount),
        token: p.token,
        usdAmount: toNumber(p.usdAmount),
        status: p.status,
        requestedAt: p.requestedAt,
        completedAt: p.completedAt,
        txHash: p.txHash,
      })),
    };
  }
}
