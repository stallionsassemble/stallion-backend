import { ApiProperty } from '@nestjs/swagger';
import { HackathonType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Min,
  ValidateNested,
} from 'class-validator';

export class HackathonPrizeDto {
  @ApiProperty()
  @IsInt()
  @Min(1)
  position: number;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  amount: number;

  @ApiProperty({
    required: false,
    description:
      'Track this prize belongs to. Off-chain only: the contract still sees one flat list of positions.',
  })
  @IsOptional()
  @IsString()
  @Length(1, 80)
  track?: string;
}

export class CreateHackathonDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  slug: string;

  @ApiProperty({ enum: HackathonType })
  @IsEnum(HackathonType, {
    message: `type must be one of: ${Object.values(HackathonType).join(', ')}`,
  })
  type: HackathonType;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  // Each entry may be a full multi-line block of text
  @Length(1, 5000, { each: true })
  deliverables: string[];

  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  tags: string[];

  @ApiProperty()
  @IsDateString()
  deadline: string;

  @ApiProperty({
    required: false,
    description:
      'Date when the hackathon will be published. If not specified, it will be published immediately.',
  })
  @IsOptional()
  @IsDateString()
  announcementDate?: string;

  @ApiProperty()
  @IsNumber()
  @Min(1, { message: 'totalBudget must be at least 1' })
  totalBudget: number;

  @ApiProperty({
    description: 'Supported currency code (e.g. XLM, USDC, EURC)',
    example: 'USDC',
  })
  @IsString()
  @IsNotEmpty()
  asset: string;

  @ApiProperty({ type: [HackathonPrizeDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => HackathonPrizeDto)
  prizePool: HackathonPrizeDto[];

  @ApiProperty({
    required: false,
    type: Object,
    description: 'Map of title to link',
    example: { title: 'link' },
  })
  @IsOptional()
  documents?: Record<string, string>;

  @ApiProperty({ required: false, type: Object, example: { title: 'link' } })
  @IsOptional()
  attachments?: any;

  @ApiProperty()
  @IsBoolean()
  teamBased: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxTeamSize?: number;

  @ApiProperty({
    required: false,
    type: [Object],
    description:
      'Application form questions shown to participants. Validated by validateApplicationForm.',
  })
  @IsOptional()
  @IsArray()
  applicationForm?: Record<string, unknown>[];

  @ApiProperty({
    required: false,
    type: [Object],
    description:
      'Extra questions asked when a project is submitted, e.g. a pitch deck link.',
  })
  @IsOptional()
  @IsArray()
  submissionForm?: Record<string, unknown>[];

  @ApiProperty({
    required: false,
    description:
      'When true, applications stay PENDING until an admin accepts them.',
  })
  @IsOptional()
  @IsBoolean()
  requiresApproval?: boolean;

  @ApiProperty({ required: false, type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tracks?: string[];

  @ApiProperty({
    required: false,
    type: [String],
    description: 'What participants need to take part, shown on the hackathon page.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  requirements?: string[];

  @ApiProperty({ description: 'ID of the Project Owner who will act as judge' })
  @IsString()
  @IsNotEmpty()
  companyId: string;
}
