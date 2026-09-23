/**
 * Centralised helpers for determining a user's MFA status.
 *
 * Every part of the codebase that needs to answer "does this user have 2FA?"
 * should use these helpers instead of ad-hoc checks, so the definition stays
 * consistent across guards, services, controllers, and API responses.
 */

interface MfaUser {
  mfaEnabled: boolean;
  totpSecret?: string | null;
}

interface MfaUserWithPasskeys extends MfaUser {
  passkeys?: { id: string }[] | null;
}

/**
 * Returns `true` when the user has **at least one** second-factor method
 * configured (TOTP authenticator **or** WebAuthn passkey).
 */
export function hasAny2FA(user: MfaUserWithPasskeys): boolean {
  return hasTOTP(user) || hasPasskeys(user);
}

/**
 * Returns `true` when the user has a verified TOTP authenticator app set up.
 *
 * Both `mfaEnabled` **and** `totpSecret` must be present — the flag alone is
 * not sufficient because ghost states (`mfaEnabled = true`, `totpSecret = null`)
 * have occurred historically.
 */
export function hasTOTP(user: MfaUser): boolean {
  return user.mfaEnabled && !!user.totpSecret;
}

/**
 * Returns `true` when the user has at least one registered WebAuthn passkey.
 */
export function hasPasskeys(
  user: Pick<MfaUserWithPasskeys, 'passkeys'>,
): boolean {
  return (user.passkeys?.length ?? 0) > 0;
}
