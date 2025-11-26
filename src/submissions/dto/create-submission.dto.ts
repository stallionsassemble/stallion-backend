import { ApiProperty } from '@nestjs/swagger';
import { IsObject } from 'class-validator';

export class CreateSubmissionDto {
  @ApiProperty({
    description: 'Submission data (links, files, description, etc.)',
    example: {
      githubUrl: 'https://github.com/user/repo',
      description: 'My solution',
      demo: 'https://demo.com',
    },
  })
  @IsObject()
  submission: any;
}
