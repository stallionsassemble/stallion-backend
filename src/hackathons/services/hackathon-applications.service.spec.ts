import { BadRequestException } from '@nestjs/common';
import { HackathonApplicationsService } from './hackathon-applications.service';

const form = [
  { id: 'name', type: 'SHORT_TEXT', label: 'Name', required: true },
  {
    id: 'mode',
    type: 'TEAM_MODE',
    label: 'How?',
    required: true,
    options: ['Need team', 'Have team'],
  },
  {
    id: 'team',
    type: 'TEAM_NAME',
    label: 'Team name',
    required: false,
    visibleWhen: { questionId: 'mode', equals: 'Have team' },
  },
];

function setup(overrides: Record<string, unknown> = {}, team: unknown = null) {
  const hackathon = {
    id: 'h1',
    title: 'Hack',
    slug: 'hack',
    status: 'PUBLISHED',
    deadline: new Date(Date.now() + 86400000),
    teamBased: true,
    maxTeamSize: 2,
    requiresApproval: false,
    applicationForm: form,
    ...overrides,
  };
  const tx = {
    hackathonTeam: {
      findFirst: jest.fn().mockResolvedValue(team),
      create: jest.fn().mockResolvedValue({ id: 't-new' }),
    },
    hackathonParticipant: {
      create: jest
        .fn()
        .mockImplementation(({ data }) => ({ id: 'p1', ...data })),
    },
  };
  const prisma = {
    hackathon: { findUnique: jest.fn().mockResolvedValue(hackathon) },
    hackathonParticipant: { findUnique: jest.fn().mockResolvedValue(null) },
    user: { findUnique: jest.fn().mockResolvedValue(null) },
    $transaction: jest.fn((fn) => fn(tx)),
  };
  const service = new HackathonApplicationsService(
    prisma as never,
    { sendHackathonApplicationEmail: jest.fn() } as never,
    { get: jest.fn() } as never,
  );
  return { service, tx, prisma };
}

describe('HackathonApplicationsService.apply', () => {
  it('accepts immediately for open hackathons and flags a team seeker', async () => {
    const { service } = setup();
    const p = await service.apply('u1', 'h1', {
      name: 'Ada',
      mode: 'Need team',
    });
    expect(p.status).toBe('ACCEPTED');
    expect(p.lookingForTeam).toBe(true);
    expect(p.teamId).toBeNull();
  });

  it('keeps the application pending when approval is required', async () => {
    const { service } = setup({ requiresApproval: true });
    const p = await service.apply('u1', 'h1', {
      name: 'Ada',
      mode: 'Need team',
    });
    expect(p.status).toBe('PENDING');
  });

  it('creates the team when the name is new, with the applicant as leader', async () => {
    const { service, tx } = setup();
    const p = await service.apply('u1', 'h1', {
      name: 'Ada',
      mode: 'Have team',
      team: 'The Mares',
    });
    expect(tx.hackathonTeam.create).toHaveBeenCalledWith({
      data: { name: 'The Mares', leaderId: 'u1', hackathonId: 'h1' },
    });
    expect(p.teamId).toBe('t-new');
  });

  it('joins an existing team by name', async () => {
    const { service, tx } = setup(
      {},
      { id: 't1', name: 'The Mares', _count: { participants: 1 } },
    );
    const p = await service.apply('u2', 'h1', {
      name: 'Bea',
      mode: 'Have team',
      team: 'the mares',
    });
    expect(tx.hackathonTeam.create).not.toHaveBeenCalled();
    expect(p.teamId).toBe('t1');
  });

  it('refuses a full team', async () => {
    const { service } = setup(
      {},
      { id: 't1', name: 'The Mares', _count: { participants: 2 } },
    );
    await expect(
      service.apply('u3', 'h1', {
        name: 'Cy',
        mode: 'Have team',
        team: 'The Mares',
      }),
    ).rejects.toThrow(/already full/);
  });

  it('requires answers when the hackathon has a form', async () => {
    const { service } = setup();
    await expect(service.apply('u1', 'h1')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('allows one-click registration when there is no form', async () => {
    const { service } = setup({ applicationForm: null });
    const p = await service.apply('u1', 'h1');
    expect(p.status).toBe('ACCEPTED');
  });
});

describe('HackathonApplicationsService admin review and grouping', () => {
  function adminSetup(participants: Array<Record<string, unknown>> = []) {
    const hackathon = {
      id: 'h1',
      title: 'Hack',
      slug: 'hack',
      teamBased: true,
      maxTeamSize: 3,
    };
    const tx = {
      hackathonParticipant: {
        findMany: jest.fn().mockResolvedValue(participants),
        updateMany: jest.fn().mockResolvedValue({ count: participants.length }),
      },
      hackathonTeam: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 't-new', name: 'Matched' }),
      },
    };
    const prisma = {
      hackathon: { findUnique: jest.fn().mockResolvedValue(hackathon) },
      hackathonParticipant: {
        findFirst: jest
          .fn()
          .mockResolvedValue({ id: 'p1', userId: 'u1', status: 'PENDING' }),
        update: jest
          .fn()
          .mockImplementation(({ data }) => ({ id: 'p1', ...data })),
      },
      user: { findUnique: jest.fn().mockResolvedValue(null) },
      $transaction: jest.fn((fn) => fn(tx)),
    };
    const service = new HackathonApplicationsService(
      prisma as never,
      { sendHackathonApplicationEmail: jest.fn() } as never,
      { get: jest.fn() } as never,
    );
    return { service, prisma, tx };
  }

  it('accepts an application and records who reviewed it', async () => {
    const { service, prisma } = adminSetup();
    const result = await service.reviewApplication(
      'h1',
      'p1',
      'admin1',
      'ACCEPTED' as never,
      ' welcome ',
    );
    expect(result.status).toBe('ACCEPTED');
    expect(prisma.hackathonParticipant.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          reviewedById: 'admin1',
          reviewNote: 'welcome',
        }),
      }),
    );
  });

  it('clears team seat and matching pool when rejecting', async () => {
    const { service, prisma } = adminSetup();
    await service.reviewApplication('h1', 'p1', 'admin1', 'REJECTED' as never);
    expect(prisma.hackathonParticipant.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ teamId: null, lookingForTeam: false }),
      }),
    );
  });

  it('groups unmatched applicants into one team', async () => {
    const { service, tx } = adminSetup([
      { id: 'p1', userId: 'u1', teamId: null, status: 'ACCEPTED' },
      { id: 'p2', userId: 'u2', teamId: null, status: 'ACCEPTED' },
    ]);
    const team = await service.groupIntoTeam('h1', 'Matched', ['p1', 'p2']);
    expect(tx.hackathonTeam.create).toHaveBeenCalledWith({
      data: { name: 'Matched', hackathonId: 'h1', leaderId: 'u1' },
    });
    expect(tx.hackathonParticipant.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['p1', 'p2'] } },
      data: { teamId: 't-new', lookingForTeam: false },
    });
    expect(team.memberCount).toBe(2);
  });

  it('refuses to group someone who already has a team', async () => {
    const { service } = adminSetup([
      { id: 'p1', userId: 'u1', teamId: 'other', status: 'ACCEPTED' },
    ]);
    await expect(
      service.groupIntoTeam('h1', 'Matched', ['p1']),
    ).rejects.toThrow(/already have a team/);
  });

  it('refuses a team larger than the hackathon allows', async () => {
    const { service } = adminSetup();
    await expect(
      service.groupIntoTeam('h1', 'Big', ['a', 'b', 'c', 'd']),
    ).rejects.toThrow(/at most 3/);
  });
});
