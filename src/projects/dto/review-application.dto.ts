import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class ReviewApplicationDto {
  @ApiProperty({
    description: 'Application status',
    enum: ['ACCEPTED', 'REJECTED'],
  })
  @IsEnum(['ACCEPTED', 'REJECTED'])
  status: 'ACCEPTED' | 'REJECTED';

  @ApiPropertyOptional({
    description: 'Rejection reason (required if rejecting)',
  })
  @IsOptional()
  @IsString()
  rejectionReason?: string;
}
