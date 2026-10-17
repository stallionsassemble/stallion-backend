import { BadRequestException, ForbiddenException } from '@nestjs/common';
// The wallet and contract services pull in Stellar code that is not needed for these tests.
jest.mock('../../wallet/contributor-funding.service', () => ({
  ContributorFundingService: class {},
}));
jest.mock('./hackathon-contract.service', () => ({
  HackathonContractService: class {},
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
