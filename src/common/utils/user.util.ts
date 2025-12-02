/* eslint-disable @typescript-eslint/no-unused-vars */
import { User } from '@prisma/client';

export const sanitizeUser = (user: User) => {
  const { totpSecret, backupCodes, refreshToken, ...sanitizedUser } = user;
  return sanitizedUser;
};
