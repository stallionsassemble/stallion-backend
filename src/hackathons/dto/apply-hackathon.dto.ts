import { ApiProperty } from '@nestjs/swagger';
import { IsObject, IsOptional } from 'class-validator';

export class ApplyHackathonDto {
  @ApiProperty({
    required: false,
    type: Object,
    description:
      "Answers keyed by question id, matching the hackathon's application form.",
    example: { full_name: 'Ada Lovelace', roles: ['Backend Developer'] },
  })
  @IsOptional()
  @IsObject()
  answers?: Record<string, string | string[]>;
}
