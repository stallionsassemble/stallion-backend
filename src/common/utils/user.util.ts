/* eslint-disable @typescript-eslint/no-unused-vars */
import { User, Wallet } from '@prisma/client';

export const sanitizeUser = (
  user: User & {
    wallet?: Partial<Wallet> | null;
    passkeys?: { id: string }[] | null;
  },
) => {
  const {
    totpSecret,
    pendingTotpSecret,
    backupCodes,
    refreshToken,
    passkeys,
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

  return {
    ...sanitizedUser,
    mfaEnabled: Boolean(user.mfaEnabled && user.totpSecret),
    hasPasskeys: (user.passkeys?.length ?? 0) > 0,
  };
};

export type SanitizedUser = ReturnType<typeof sanitizeUser>;
