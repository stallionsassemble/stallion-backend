import { randomBytes } from 'crypto';

export function generateIdempotencyKey(): string {
  return randomBytes(16).toString('hex');
}
