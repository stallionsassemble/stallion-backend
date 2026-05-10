import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  BountyStatus,
  Gender,
  HackathonStatus,
  PayoutSourceType,
  PayoutStatus,
  ProjectStatus,
  Role,
  UserStatus,
} from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsISO8601,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Length,
  Min,
} from 'class-validator';

export class AdminPaginationQueryDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional({ default: 10, minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  limit?: number = 10;
}

export class StepUpTotpDto {
  @ApiProperty({ example: '123456' })
  @IsString()
  @Length(6, 10)
  code: string;
}

export class StepUpPasskeyVerifyDto {
  @ApiProperty({
    description: 'WebAuthn authentication response object',
    example: {
      id: 'passkey-credential-id',
      rawId: 'base64url-encoded-raw-id',
      type: 'public-key',
      response: {},
    },
  })
  @IsObject()
  response: any;
}

export class SetFundingWalletDto {
  @ApiProperty({ description: 'Funding wallet ID' })
  @IsString()
  @IsNotEmpty()
  fundingWalletId: string;
}

export class AdminUserQueryDto extends AdminPaginationQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: Role })
  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @ApiPropertyOptional({ enum: UserStatus })
  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;

  @ApiPropertyOptional({ enum: Gender })
  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;

  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  createdFrom?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  createdTo?: string;
}

export class AdminCreateUserDto {
  @ApiProperty({ example: 'newuser@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ enum: Role, example: Role.CONTRIBUTOR })
  @IsEnum(Role)
  role: Role;
}

export class SuspendUserDto {
  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  indefinite?: boolean = false;

  @ApiPropertyOptional({
    description:
      'Suspension duration in hours. Required unless indefinite=true',
    minimum: 1,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  durationHours?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;
}

export class BanUserDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;
}

export class ToggleFeatureDto {
  @ApiProperty()
  @IsBoolean()
  isFeatured: boolean;
}

export class AdminBountyQueryDto extends AdminPaginationQueryDto {
  @ApiPropertyOptional({ enum: BountyStatus })
  @IsOptional()
  @IsEnum(BountyStatus)
  status?: BountyStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  ownerId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional()
  @Type(() => Boolean)
  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;
}

export class AdminProjectQueryDto extends AdminPaginationQueryDto {
  @ApiPropertyOptional({ enum: ProjectStatus })
  @IsOptional()
  @IsEnum(ProjectStatus)
  status?: ProjectStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  ownerId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  type?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional()
  @Type(() => Boolean)
  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;
}

export class AdminPayoutQueryDto extends AdminPaginationQueryDto {
  @ApiPropertyOptional({ enum: PayoutStatus })
  @IsOptional()
  @IsEnum(PayoutStatus)
  status?: PayoutStatus;

  @ApiPropertyOptional({ enum: PayoutSourceType })
  @IsOptional()
  @IsEnum(PayoutSourceType)
  sourceType?: PayoutSourceType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  token?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  requestedFrom?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  requestedTo?: string;
}

export class AdminHackathonQueryDto extends AdminPaginationQueryDto {
  @ApiPropertyOptional({ enum: HackathonStatus })
  @IsOptional()
  @IsEnum(HackathonStatus)
  status?: HackathonStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  ownerId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;
}

export class AdminCreateHackathonDto {
  @ApiProperty()
  @IsString()
  ownerId: string;

  @ApiProperty({
    description:
      'Hackathon creation payload (same shape as public create hackathon endpoint)',
    example: {
      title: 'Stallion Hack Week',
      description: 'Build and submit your best product ideas',
      deadline: '2026-04-30T23:59:59.000Z',
      announcementDate: '2026-04-01T00:00:00.000Z',
      totalBudget: 10000,
      asset: 'USDC',
      prizePool: [
        { position: 1, amount: 5000 },
        { position: 2, amount: 3000 },
        { position: 3, amount: 2000 },
      ],
      deliverables: ['GitHub Link'],
      tags: ['Innovation'],
      teamBased: true,
      maxTeamSize: 4,
    },
  })
  @IsObject()
  payload: Record<string, any>;
}

export class StepUpTokenResponseDto {
  @ApiProperty({
    description: 'Short-lived admin step-up token',
    example: 'f2d5f5f4d9f5f2...',
  })
  token: string;

  @ApiProperty({
    description: 'Step-up token TTL in seconds',
    example: 600,
  })
  expiresInSeconds: number;
}

export class FundingWalletResponseDto {
  @ApiPropertyOptional({
    description: 'Resolved funding wallet id or null',
    example: 'cm2fundingwallet123',
    nullable: true,
  })
  fundingWalletId: string | null;

  @ApiProperty({
    description: 'Where funding wallet was resolved from',
    enum: ['admin', 'env', 'none'],
    example: 'admin',
  })
  source: 'admin' | 'env' | 'none';
}

export class AdminActionResponseDto {
  @ApiProperty({ example: 'Operation completed successfully' })
  message: string;
}

export class PaginatedMetaDto {
  @ApiProperty({ example: 120 })
  total: number;

  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 10 })
  limit: number;

  @ApiProperty({ example: 12 })
  totalPages: number;

  @ApiProperty({ example: true })
  hasNextPage: boolean;

  @ApiProperty({ example: false })
  hasPreviousPage: boolean;
}
