export const POINTS_CONFIG = {
  SUBMISSION_CREATED: 10,
  SUBMISSION_APPROVED: 50,
  BOUNTY_WON: 100,
  BOUNTY_CREATED: 5,
} as const;

export type PointsAction = keyof typeof POINTS_CONFIG;
