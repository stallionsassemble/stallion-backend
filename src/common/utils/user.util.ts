/* eslint-disable @typescript-eslint/no-unused-vars */
import { User, Wallet } from '@prisma/client';

export const sanitizeUser = (
  user: User & { wallet?: Partial<Wallet> | null },
) => {
  const { totpSecret, backupCodes, refreshToken, ...sanitizedUser } = user;

  // Sanitize wallet
  if (user.wallet) {
    user.wallet = {
      id: user.wallet.id,
      publicKey: user.wallet.publicKey,
      isActivated: user.wallet.isActivated,
      createdAt: user.wallet.createdAt,
    };
  }

  return sanitizedUser;
};

export type SanitizedUser = ReturnType<typeof sanitizeUser>;
