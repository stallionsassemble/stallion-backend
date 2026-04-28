import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class SelectWinnerDto {
  @ApiProperty({ description: 'ID of the submission to select as a winner' })
  @IsString()
  submissionId: string;

  @ApiProperty({ description: 'Position in the prize pool (1st = 1, 2nd = 2)' })
  @IsInt()
  @Min(1)
  position: number;

  @ApiProperty({
    required: false,
    description: 'Optional feedback for the winner',
  })
  @IsOptional()
  @IsString()
  feedback?: string;
}
