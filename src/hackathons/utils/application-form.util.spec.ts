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
