import { SetMetadata } from '@nestjs/common';

export const REQUIRES_COMPLETE_PROFILE_KEY = 'requiresCompleteProfile';
export const RequiresCompleteProfile = () =>
  SetMetadata(REQUIRES_COMPLETE_PROFILE_KEY, true);
