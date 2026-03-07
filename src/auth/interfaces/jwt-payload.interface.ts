import { Role, UserStatus } from '@prisma/client';

export interface JwtPayload {
  sub: string;
  email: string;
  role: Role;
}

export interface RequestUser {
  id: string;
  email: string;
  role: Role;
  profileCompleted: boolean;
  status: UserStatus;
}
