import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsString,
  ValidateNested,
} from 'class-validator';

class WinnerDto {
  @IsString()
  submissionId: string;

  @IsString()
  userId: string;
}

export class HackathonSelectWinnersDto {
  @IsString()
  trackId: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WinnerDto)
  @ArrayMinSize(1)
  winners: WinnerDto[]; // Ordered by position (1st, 2nd, 3rd, etc.)
}
