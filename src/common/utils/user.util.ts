import { User } from '@prisma/client';

export const sanitizeUser = (user: User) => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { password, totpSecret, backupCodes, refreshToken, ...sanitizedUser } =
    user;
  return sanitizedUser;
};
