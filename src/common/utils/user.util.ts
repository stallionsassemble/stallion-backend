/* eslint-disable @typescript-eslint/no-unused-vars */
import { User, Wallet } from '@prisma/client';

export const sanitizeUser = (
  user: User & { wallet?: Partial<Wallet> | null },
) => {
  const {
    totpSecret,
    pendingTotpSecret,
    backupCodes,
    refreshToken,
    ...sanitizedUser
  } = user;

  // Sanitize wallet
  if (sanitizedUser.wallet) {
    sanitizedUser.wallet = {
      id: sanitizedUser.wallet.id,
      publicKey: sanitizedUser.wallet.publicKey,
      isActivated: sanitizedUser.wallet.isActivated,
      createdAt: sanitizedUser.wallet.createdAt,
    };
  }

  return sanitizedUser;
};

export type SanitizedUser = ReturnType<typeof sanitizeUser>;
