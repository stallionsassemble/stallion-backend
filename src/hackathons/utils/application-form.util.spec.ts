import { BadRequestException } from '@nestjs/common';
import {
  normaliseTracks,
  validateApplicationForm,
} from './application-form.util';

describe('validateApplicationForm', () => {
  const valid = [
    { id: 'name', type: 'SHORT_TEXT', label: 'Full name', required: true },
    {
      id: 'mode',
      type: 'TEAM_MODE',
      label: 'How are you registering?',
      required: true,
      options: ['I need a team', 'I have a team'],
    },
    {
      id: 'team',
      type: 'TEAM_NAME',
      label: 'Team name',
      required: false,
      visibleWhen: { questionId: 'mode', equals: 'I have a team' },
    },
  ];

  it('accepts a valid form and keeps order', () => {
    const result = validateApplicationForm(valid);
    expect(result.map((q) => q.id)).toEqual(['name', 'mode', 'team']);
    expect(result[2].visibleWhen?.questionId).toBe('mode');
  });

  it('treats missing input as an empty form', () => {
    expect(validateApplicationForm(undefined)).toEqual([]);
    expect(validateApplicationForm(null)).toEqual([]);
  });

  it.each([
    [
      'choice with one option',
      [{ id: 'a', type: 'DROPDOWN', label: 'x', options: ['1'] }],
    ],
    [
      'duplicate ids',
      [
        { id: 'a', type: 'SHORT_TEXT', label: 'x' },
        { id: 'a', type: 'SHORT_TEXT', label: 'y' },
      ],
    ],
    [
      'team mode with three options',
      [{ id: 'a', type: 'TEAM_MODE', label: 'x', options: ['1', '2', '3'] }],
    ],
    [
      'dependency on a missing question',
      [
        {
          id: 'a',
          type: 'SHORT_TEXT',
          label: 'x',
          visibleWhen: { questionId: 'zz', equals: '1' },
        },
      ],
    ],
    ['unknown type', [{ id: 'a', type: 'NOPE', label: 'x' }]],
    ['empty label', [{ id: 'a', type: 'SHORT_TEXT', label: '  ' }]],
  ])('rejects %s', (_name, form) => {
    expect(() => validateApplicationForm(form)).toThrow(BadRequestException);
  });
});

describe('normaliseTracks', () => {
  it('trims, drops blanks and de-duplicates case-insensitively', () => {
    expect(normaliseTracks([' Main ', 'main', '', 'DeFi'])).toEqual([
      'Main',
      'DeFi',
    ]);
  });
});

import { validateApplicationAnswers } from './application-form.util';

describe('validateApplicationAnswers', () => {
  const form = validateApplicationForm([
    { id: 'name', type: 'SHORT_TEXT', label: 'Full name', required: true },
    { id: 'email', type: 'EMAIL', label: 'Email', required: true },
    {
      id: 'roles',
      type: 'MULTI_CHOICE',
      label: 'Roles',
      required: true,
      options: ['Frontend', 'Backend'],
    },
    {
      id: 'mode',
      type: 'TEAM_MODE',
      label: 'How?',
      required: true,
      options: ['I need a team', 'I have a team'],
    },
    {
      id: 'team',
      type: 'TEAM_NAME',
      label: 'Team name',
      required: true,
      visibleWhen: { questionId: 'mode', equals: 'I have a team' },
    },
  ]);

  const base = {
    name: ' Ada ',
    email: 'ada@example.com',
    roles: ['Frontend'],
  };

  it('accepts a solo applicant and ignores the hidden team name', () => {
    const r = validateApplicationAnswers(form, {
      ...base,
      mode: 'I need a team',
      team: 'ignored',
    });
    expect(r.teamIntent).toBe('NEED_TEAM');
    expect(r.teamName).toBeNull();
    expect(r.answers.name).toBe('Ada');
    expect(r.answers.team).toBeUndefined();
  });

  it('requires and returns the team name for an existing team', () => {
    const r = validateApplicationAnswers(form, {
      ...base,
      mode: 'I have a team',
      team: ' The Mares ',
    });
    expect(r.teamIntent).toBe('EXISTING_TEAM');
    expect(r.teamName).toBe('The Mares');
  });

  it('lists every problem at once', () => {
    expect(() =>
      validateApplicationAnswers(form, {
        name: '',
        email: 'nope',
        roles: ['Designer'],
        mode: 'I have a team',
      }),
    ).toThrow(/Full name.*required.*Email.*valid email.*Roles.*invalid/s);
  });

  it('rejects an existing team without a name', () => {
    expect(() =>
      validateApplicationAnswers(form, { ...base, mode: 'I have a team' }),
    ).toThrow(/Team name.*required/);
  });
});

import { normalisePrizeTracks } from './application-form.util';

describe('normalisePrizeTracks', () => {
  const tracks = ['DeFi', 'Payments'];

  it('leaves a shared pool alone', () => {
    const pool = [
      { position: 1, amount: 5 },
      { position: 2, amount: 3 },
    ];
    expect(normalisePrizeTracks(pool, tracks).map((p) => p.track)).toEqual([
      undefined,
      undefined,
    ]);
  });

  it('keeps global positions and canonicalises track names', () => {
    const result = normalisePrizeTracks(
      [
        { position: 1, amount: 5, track: 'defi' },
        { position: 2, amount: 3, track: ' DeFi ' },
        { position: 3, amount: 4, track: 'PAYMENTS' },
      ],
      tracks,
    );
    expect(result.map((p) => [p.position, p.track])).toEqual([
      [1, 'DeFi'],
      [2, 'DeFi'],
      [3, 'Payments'],
    ]);
  });

  it('rejects a mix of tracked and untracked prizes', () => {
    expect(() =>
      normalisePrizeTracks(
        [
          { position: 1, amount: 1, track: 'DeFi' },
          { position: 2, amount: 1 },
        ],
        tracks,
      ),
    ).toThrow(/every prize a track or none/);
  });

  it('rejects unknown tracks and tracks when the hackathon has none', () => {
    expect(() =>
      normalisePrizeTracks(
        [{ position: 1, amount: 1, track: 'Gaming' }],
        tracks,
      ),
    ).toThrow(/not one of/);
    expect(() =>
      normalisePrizeTracks([{ position: 1, amount: 1, track: 'DeFi' }], []),
    ).toThrow(/Add tracks/);
  });
});
