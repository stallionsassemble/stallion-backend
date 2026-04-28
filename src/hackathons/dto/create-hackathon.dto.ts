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
  @IsEnum(HackathonType)
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

  @ApiProperty()
  @IsDateString()
  announcementDate: string;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  totalBudget: number;

  @ApiProperty({ description: 'Token contract address for the prize pool' })
  @IsString()
  @IsNotEmpty()
  token: string;

  @ApiProperty({ description: 'Asset identifier (e.g. XLM or USDC)' })
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
