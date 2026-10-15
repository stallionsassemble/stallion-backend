import { authenticator } from 'otplib';

// Authenticator apps and the server clock are rarely perfectly in sync. The default (window 0)
// only accepts the current 30s code, so a few seconds of drift or a code entered just after it
// rolls over is rejected as "invalid". Accept one step either side (about ±30s), the usual TOTP
// recommendation.
const totp = authenticator.clone({ window: 1 });

export function verifyTotpCode(token: string, secret: string): boolean {
  const normalized = String(token ?? '').replace(/\s+/g, '');
  if (!/^\d{6}$/.test(normalized)) return false;
  try {
    return totp.verify({ token: normalized, secret });
  } catch {
    return false;
  }
}
