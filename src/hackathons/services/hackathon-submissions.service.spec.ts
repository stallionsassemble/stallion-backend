import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { HackathonSubmissionsService } from './hackathon-submissions.service';

function setup(
  hackathon: Record<string, unknown> = {},
  participant: Record<string, unknown> | null = {
    status: 'ACCEPTED',
    teamId: null,
  },
) {
  const prisma = {
    hackathon: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'h1',
        status: 'PUBLISHED',
        deadline: new Date(Date.now() + 86400000),
        teamBased: false,
        tracks: [],
        ...hackathon,
      }),
    },
    hackathonParticipant: {
      findUnique: jest.fn().mockResolvedValue(participant),
    },
    hackathonSubmission: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation(({ data }) => data),
    },
  };
  return { service: new HackathonSubmissionsService(prisma as never), prisma };
}

const dto = {
  title: 'T',
  submissionLink: 'https://x.io',
  repositoryUrl: 'https://github.com/team/project',
  hackathonId: 'h1',
};

describe('HackathonSubmissionsService.createSubmission', () => {
  it('blocks applicants whose application is pending or rejected', async () => {
    for (const status of ['PENDING', 'REJECTED']) {
      const { service } = setup({}, { status, teamId: null });
      await expect(service.createSubmission('u1', dto)).rejects.toThrow(
        ForbiddenException,
      );
    }
  });

  it('allows an accepted applicant when there are no tracks', async () => {
    const { service } = setup();
    const result = await service.createSubmission('u1', dto);
    expect(result.track).toBeUndefined();
  });

  it('requires a valid track when the hackathon has tracks', async () => {
    const { service } = setup({ tracks: ['DeFi', 'Payments'] });
    await expect(service.createSubmission('u1', dto)).rejects.toThrow(
      BadRequestException,
    );
    await expect(
      service.createSubmission('u1', { ...dto, track: 'Gaming' }),
    ).rejects.toThrow(/Choose a track/);
  });

  it('stores the canonical track name, ignoring case', async () => {
    const { service } = setup({ tracks: ['DeFi', 'Payments'] });
    const result = await service.createSubmission('u1', {
      ...dto,
      track: ' defi ',
    });
    expect(result.track).toBe('DeFi');
  });

  it('requires a repository link', async () => {
    const { service } = setup();
    await expect(
      service.createSubmission('u1', { ...dto, repositoryUrl: '' }),
    ).rejects.toThrow(/repository/);
    await expect(
      service.createSubmission('u1', { ...dto, repositoryUrl: 'not a link' }),
    ).rejects.toThrow(BadRequestException);
  });
});
