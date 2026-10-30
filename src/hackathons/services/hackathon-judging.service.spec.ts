import { BadRequestException, ForbiddenException } from '@nestjs/common';
// The wallet and contract services pull in Stellar code that is not needed for these tests.
jest.mock('../../wallet/contributor-funding.service', () => ({
  ContributorFundingService: class {},
}));
jest.mock('./hackathon-contract.service', () => ({
  HackathonContractService: class {},
}));
jest.mock('../../common/utils/token-price.util', () => ({
  calculateUsdValue: jest.fn().mockResolvedValue(10),
}));

import { HackathonJudgingService } from './hackathon-judging.service';

function setup(hackathon: Record<string, unknown> = {}) {
  const prisma = {
    hackathon: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'h1',
        companyId: 'owner1',
        status: 'JUDGING',
        prizePool: [],
        ...hackathon,
      }),
    },
    hackathonSubmission: {
      findUnique: jest
        .fn()
        .mockResolvedValue({ id: 's1', hackathonId: 'h1', status: 'PENDING' }),
      update: jest.fn().mockResolvedValue({ id: 's1', status: 'IN_REVIEW' }),
    },
  };
  const service = new HackathonJudgingService(
    prisma as never,
    {} as never,
    {} as never,
  );
  return { service, prisma };
}

describe('HackathonJudgingService.setInReview', () => {
  it('lets the assigned project owner review', async () => {
    const { service } = setup();
    await expect(
      service.setInReview('h1', 'owner1', 's1'),
    ).resolves.toBeDefined();
  });

  it('rejects another project owner', async () => {
    const { service } = setup();
    await expect(
      service.setInReview('h1', 'someone-else', 's1'),
    ).rejects.toThrow(ForbiddenException);
  });

  it('lets an admin review any hackathon', async () => {
    const { service } = setup();
    await expect(
      service.setInReview('h1', 'admin1', 's1', true),
    ).resolves.toBeDefined();
  });

  it('still requires the judging phase, even for admins', async () => {
    const { service } = setup({ status: 'PUBLISHED' });
    await expect(
      service.setInReview('h1', 'admin1', 's1', true),
    ).rejects.toThrow(BadRequestException);
    await expect(service.setInReview('h1', 'owner1', 's1')).rejects.toThrow(
      /judging phase/,
    );
  });
});

function payoutSetup(hackathon: Record<string, unknown> = {}) {
  const fullHackathon = {
    id: 'h1',
    companyId: 'owner1',
    status: 'JUDGING',
    payoutMode: 'MANUAL',
    contractHackathonId: null,
    currency: 'USDC',
    resultsPublished: false,
    prizePool: [{ position: 1, amount: 10 }],
    createdBy: { wallet: null },
    ...hackathon,
  };
  const winner = {
    id: 'w1',
    hackathonId: 'h1',
    position: 1,
    prizeAmount: { toString: () => '10' },
    userId: 'u1',
    submissionId: 's1',
    createdAt: new Date(),
    isPaid: false,
    user: { wallet: { id: 'wal1', publicKey: 'GABC' } },
  };
  const prisma = {
    hackathon: {
      findUnique: jest.fn().mockResolvedValue(fullHackathon),
      update: jest.fn().mockResolvedValue(fullHackathon),
    },
    hackathonWinner: {
      findMany: jest.fn().mockResolvedValue([winner]),
      findUnique: jest.fn().mockResolvedValue({
        ...winner,
        hackathon: { ...fullHackathon, resultsPublished: true },
        payout: { id: 'p1', metadata: { position: 1 } },
      }),
      update: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      findUniqueOrThrow: jest
        .fn()
        .mockResolvedValue({ id: 'w1', isPaid: true }),
    },
    payout: { upsert: jest.fn(), update: jest.fn() },
    $transaction: jest.fn((fn: (tx: unknown) => unknown) => fn(prisma)),
  };
  const contract = { distributePrizes: jest.fn() };
  const service = new HackathonJudgingService(
    prisma as never,
    contract as never,
    {} as never,
  );
  return { service, prisma, contract };
}

describe('HackathonJudgingService.publishResults (MANUAL)', () => {
  it('skips the contract and leaves payouts pending', async () => {
    const { service, prisma, contract } = payoutSetup();
    await service.publishResults('h1', 'owner1');

    expect(contract.distributePrizes).not.toHaveBeenCalled();
    const upsert = prisma.payout.upsert.mock.calls[0][0];
    expect(upsert.create.status).toBe('PENDING_APPROVAL');
    expect(upsert.create.completedAt).toBeNull();
    expect(prisma.hackathonWinner.update).not.toHaveBeenCalled();
  });
});

describe('HackathonJudgingService.markWinnerPaid', () => {
  it('completes the payout and marks the winner paid', async () => {
    const { service, prisma } = payoutSetup();
    await service.markWinnerPaid('h1', 'w1', 'admin1', 'txhash');

    expect(prisma.hackathonWinner.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'w1', isPaid: false } }),
    );
    const update = prisma.payout.update.mock.calls[0][0];
    expect(update.data.status).toBe('COMPLETED');
    expect(update.data.txHash).toBe('txhash');
    expect(update.data.metadata).toMatchObject({
      position: 1,
      manual: true,
      markedPaidBy: 'admin1',
    });
  });

  it('requires a transaction hash or a reference', async () => {
    const { service } = payoutSetup();
    await expect(service.markWinnerPaid('h1', 'w1', 'admin1')).rejects.toThrow(
      /transaction hash or a payment reference/,
    );
  });

  it('refuses contract hackathons', async () => {
    const { service, prisma } = payoutSetup();
    prisma.hackathonWinner.findUnique.mockResolvedValue({
      hackathonId: 'h1',
      isPaid: false,
      hackathon: { payoutMode: 'CONTRACT', contractHackathonId: 1n },
      payout: { id: 'p1' },
    });
    await expect(
      service.markWinnerPaid('h1', 'w1', 'admin1', 'tx'),
    ).rejects.toThrow(/through the contract/);
  });

  it('refuses a winner someone else already marked paid', async () => {
    const { service, prisma } = payoutSetup();
    prisma.hackathonWinner.updateMany.mockResolvedValue({ count: 0 });
    await expect(
      service.markWinnerPaid('h1', 'w1', 'admin1', 'tx'),
    ).rejects.toThrow(/already marked as paid/);
  });
});
