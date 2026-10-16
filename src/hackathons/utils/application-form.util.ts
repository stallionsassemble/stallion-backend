import { BadRequestException } from '@nestjs/common';

export const APPLICATION_QUESTION_TYPES = [
  'SHORT_TEXT',
  'LONG_TEXT',
  'EMAIL',
  'URL',
  'NUMBER',
  'DROPDOWN',
  'SINGLE_CHOICE',
  'MULTI_CHOICE',
  // Team intent. Exactly two options: index 0 = the applicant needs a team,
  // index 1 = the applicant is registering with an existing team.
  'TEAM_MODE',
  // The exact team name, used to find-or-create the real team.
  'TEAM_NAME',
] as const;

export type ApplicationQuestionType =
  (typeof APPLICATION_QUESTION_TYPES)[number];

export interface ApplicationQuestion {
  id: string;
  type: ApplicationQuestionType;
  label: string;
  helpText?: string;
  required: boolean;
  options?: string[];
  section?: string;
  visibleWhen?: { questionId: string; equals: string };
}

const CHOICE_TYPES: ApplicationQuestionType[] = [
  'DROPDOWN',
  'SINGLE_CHOICE',
  'MULTI_CHOICE',
  'TEAM_MODE',
];

const MAX_QUESTIONS = 60;
const MAX_OPTIONS = 30;

/**
 * Validates and normalises an admin-defined application form.
 * Throws a BadRequestException that names the offending question.
 */
export function validateApplicationForm(input: unknown): ApplicationQuestion[] {
  if (input === undefined || input === null) return [];
  if (!Array.isArray(input)) {
    throw new BadRequestException(
      'applicationForm must be a list of questions',
    );
  }
  if (input.length > MAX_QUESTIONS) {
    throw new BadRequestException(
      `An application form can have at most ${MAX_QUESTIONS} questions`,
    );
  }

  const ids = new Set<string>();
  const questions: ApplicationQuestion[] = input.map((raw, index) => {
    const n = index + 1;
    if (!raw || typeof raw !== 'object') {
      throw new BadRequestException(`Question ${n} is invalid`);
    }
    const q = raw as Record<string, unknown>;

    const id = typeof q.id === 'string' ? q.id.trim() : '';
    if (!/^[A-Za-z0-9_-]{1,40}$/.test(id)) {
      throw new BadRequestException(`Question ${n} needs a valid id`);
    }
    if (ids.has(id)) {
      throw new BadRequestException(`Question ${n} reuses the id "${id}"`);
    }
    ids.add(id);

    const type = q.type as ApplicationQuestionType;
    if (!APPLICATION_QUESTION_TYPES.includes(type)) {
      throw new BadRequestException(`Question ${n} has an unknown type`);
    }

    const label = typeof q.label === 'string' ? q.label.trim() : '';
    if (!label || label.length > 300) {
      throw new BadRequestException(
        `Question ${n} needs a label (up to 300 characters)`,
      );
    }

    let options: string[] | undefined;
    if (CHOICE_TYPES.includes(type)) {
      const list = Array.isArray(q.options)
        ? q.options
            .map((o) => (typeof o === 'string' ? o.trim() : ''))
            .filter(Boolean)
        : [];
      if (list.length < 2 || list.length > MAX_OPTIONS) {
        throw new BadRequestException(
          `"${label}" needs between 2 and ${MAX_OPTIONS} options`,
        );
      }
      if (new Set(list).size !== list.length) {
        throw new BadRequestException(`"${label}" has duplicate options`);
      }
      if (type === 'TEAM_MODE' && list.length !== 2) {
        throw new BadRequestException(
          `"${label}" must have exactly two options (needs a team / has a team)`,
        );
      }
      options = list;
    }

    const visibleWhen =
      q.visibleWhen && typeof q.visibleWhen === 'object'
        ? (q.visibleWhen as { questionId?: unknown; equals?: unknown })
        : undefined;

    return {
      id,
      type,
      label,
      helpText:
        typeof q.helpText === 'string' && q.helpText.trim()
          ? q.helpText.trim().slice(0, 500)
          : undefined,
      required: q.required === true,
      options,
      section:
        typeof q.section === 'string' && q.section.trim()
          ? q.section.trim().slice(0, 100)
          : undefined,
      visibleWhen:
        visibleWhen &&
        typeof visibleWhen.questionId === 'string' &&
        typeof visibleWhen.equals === 'string'
          ? { questionId: visibleWhen.questionId, equals: visibleWhen.equals }
          : undefined,
    };
  });

  const teamModes = questions.filter((q) => q.type === 'TEAM_MODE').length;
  const teamNames = questions.filter((q) => q.type === 'TEAM_NAME').length;
  if (teamModes > 1 || teamNames > 1) {
    throw new BadRequestException(
      'An application form can have only one team choice and one team name question',
    );
  }

  for (const q of questions) {
    if (q.visibleWhen && !ids.has(q.visibleWhen.questionId)) {
      throw new BadRequestException(
        `"${q.label}" depends on a question that does not exist`,
      );
    }
    if (q.visibleWhen?.questionId === q.id) {
      throw new BadRequestException(`"${q.label}" cannot depend on itself`);
    }
  }

  return questions;
}

/** Trims, de-duplicates and caps a list of track names. */
export function normaliseTracks(input: unknown): string[] {
  if (input === undefined || input === null) return [];
  if (!Array.isArray(input)) {
    throw new BadRequestException('tracks must be a list of names');
  }
  const seen = new Set<string>();
  const tracks: string[] = [];
  for (const t of input) {
    const name = typeof t === 'string' ? t.trim() : '';
    if (!name) continue;
    if (name.length > 80) {
      throw new BadRequestException(
        'A track name can be at most 80 characters',
      );
    }
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    tracks.push(name);
  }
  if (tracks.length > 20) {
    throw new BadRequestException('A hackathon can have at most 20 tracks');
  }
  return tracks;
}

export type ApplicationAnswers = Record<string, string | string[]>;

export interface ValidatedApplication {
  answers: ApplicationAnswers;
  /** 'NEED_TEAM' or 'EXISTING_TEAM', when the form has a team choice. */
  teamIntent: 'NEED_TEAM' | 'EXISTING_TEAM' | null;
  teamName: string | null;
}

function isVisible(q: ApplicationQuestion, answers: ApplicationAnswers) {
  if (!q.visibleWhen) return true;
  const value = answers[q.visibleWhen.questionId];
  return Array.isArray(value)
    ? value.includes(q.visibleWhen.equals)
    : value === q.visibleWhen.equals;
}

/**
 * Checks an applicant's answers against the hackathon's form. Answers to hidden questions are
 * dropped. Throws one BadRequestException listing every problem so the user can fix them at once.
 */
export function validateApplicationAnswers(
  questions: ApplicationQuestion[],
  rawAnswers: unknown,
): ValidatedApplication {
  const input: Record<string, unknown> =
    rawAnswers && typeof rawAnswers === 'object' && !Array.isArray(rawAnswers)
      ? (rawAnswers as Record<string, unknown>)
      : {};

  // Normalise first so visibility rules compare against trimmed values.
  const normalised: ApplicationAnswers = {};
  for (const q of questions) {
    const raw = input[q.id];
    if (Array.isArray(raw)) {
      normalised[q.id] = raw
        .map((v) => (typeof v === 'string' ? v.trim() : ''))
        .filter(Boolean);
    } else if (typeof raw === 'string' || typeof raw === 'number') {
      normalised[q.id] = String(raw).trim();
    }
  }

  const problems: string[] = [];
  const answers: ApplicationAnswers = {};

  for (const q of questions) {
    if (!isVisible(q, normalised)) continue;
    const value = normalised[q.id];
    const empty = Array.isArray(value) ? value.length === 0 : !value;

    if (empty) {
      if (q.required) problems.push(`"${q.label}" is required`);
      continue;
    }

    if (q.type === 'MULTI_CHOICE') {
      const picked = Array.isArray(value) ? value : [value];
      if (picked.some((v) => !q.options?.includes(v))) {
        problems.push(`"${q.label}" has an invalid choice`);
        continue;
      }
      answers[q.id] = picked;
      continue;
    }

    if (Array.isArray(value)) {
      problems.push(`"${q.label}" must be a single answer`);
      continue;
    }

    const text = value;
    if (text.length > 5000) {
      problems.push(`"${q.label}" is too long`);
      continue;
    }
    if (
      ['DROPDOWN', 'SINGLE_CHOICE', 'TEAM_MODE'].includes(q.type) &&
      !q.options?.includes(text)
    ) {
      problems.push(`"${q.label}" has an invalid choice`);
      continue;
    }
    if (q.type === 'EMAIL' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)) {
      problems.push(`"${q.label}" must be a valid email address`);
      continue;
    }
    if (q.type === 'URL' && !/^https?:\/\/\S+\.\S+$/i.test(text)) {
      problems.push(`"${q.label}" must be a link starting with https://`);
      continue;
    }
    if (q.type === 'NUMBER' && !Number.isFinite(Number(text))) {
      problems.push(`"${q.label}" must be a number`);
      continue;
    }
    if (q.type === 'TEAM_NAME' && text.length > 80) {
      problems.push(`"${q.label}" can be at most 80 characters`);
      continue;
    }
    answers[q.id] = text;
  }

  if (problems.length > 0) {
    throw new BadRequestException(
      `Please fix your application: ${problems.join('; ')}.`,
    );
  }

  const modeQuestion = questions.find((q) => q.type === 'TEAM_MODE');
  const nameQuestion = questions.find((q) => q.type === 'TEAM_NAME');
  let teamIntent: ValidatedApplication['teamIntent'] = null;
  if (modeQuestion) {
    const chosen = answers[modeQuestion.id];
    if (typeof chosen === 'string' && modeQuestion.options) {
      teamIntent =
        chosen === modeQuestion.options[1] ? 'EXISTING_TEAM' : 'NEED_TEAM';
    }
  }
  const nameAnswer = nameQuestion ? answers[nameQuestion.id] : undefined;
  const teamName = typeof nameAnswer === 'string' ? nameAnswer : null;

  if (teamIntent === 'EXISTING_TEAM' && !teamName) {
    throw new BadRequestException(
      'Enter your team name. Everyone on the team must use the exact same name.',
    );
  }

  return { answers, teamIntent, teamName };
}

/**
 * Prizes can be tied to tracks. The contract only knows flat, unique positions, so each prize
 * keeps its global position and carries its track as off-chain metadata. Either none of the
 * prizes have a track (one shared pool) or every prize does.
 * Returns the prize list with track names normalised to the hackathon's own spelling.
 */
export function normalisePrizeTracks<T extends { track?: string }>(
  prizePool: T[],
  tracks: string[],
): T[] {
  const tagged = prizePool.filter((p) => p.track && p.track.trim()).length;
  if (tagged === 0) {
    return prizePool.map((p) => ({ ...p, track: undefined }));
  }
  if (tagged !== prizePool.length) {
    throw new BadRequestException(
      'Either give every prize a track or none of them',
    );
  }
  if (tracks.length === 0) {
    throw new BadRequestException(
      'Add tracks to the hackathon before setting prizes per track',
    );
  }
  return prizePool.map((p) => {
    const match = tracks.find(
      (t) => t.toLowerCase() === String(p.track).trim().toLowerCase(),
    );
    if (!match) {
      throw new BadRequestException(
        `Prize track "${p.track}" is not one of the hackathon's tracks (${tracks.join(', ')})`,
      );
    }
    return { ...p, track: match };
  });
}
