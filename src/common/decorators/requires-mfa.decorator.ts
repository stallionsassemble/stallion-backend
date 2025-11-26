import { SetMetadata } from '@nestjs/common';

export const REQUIRES_MFA_KEY = 'requires_mfa';
export const RequiresMFA = () => SetMetadata(REQUIRES_MFA_KEY, true);
