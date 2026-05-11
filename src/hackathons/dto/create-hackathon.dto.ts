import { ApiProperty } from '@nestjs/swagger';
import { HackathonType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
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

  @ApiProperty({ description: 'ID of the Project Owner who will act as judge' })
  @IsString()
  @IsNotEmpty()
  companyId: string;
}
