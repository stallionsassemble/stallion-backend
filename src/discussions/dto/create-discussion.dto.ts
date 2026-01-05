import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateDiscussionDto {
  @ApiProperty({
    description: 'Discussion content',
    example: 'I have a question about the requirements...',
  })
  @IsString()
  @IsNotEmpty()
  content: string;

  @ApiProperty({
    description: 'Bounty ID (required for bounty discussions)',
    example: 'bounty-uuid',
    required: false,
  })
  @IsString()
  @IsOptional()
  bountyId?: string;

  @ApiProperty({
    description: 'Project ID (required for project discussions)',
    example: 'project-uuid',
    required: false,
  })
  @IsString()
  @IsOptional()
  projectId?: string;
}

export class CreateReplyDto {
  @ApiProperty({
    description: 'Reply content',
    example: 'Here is my answer...',
  })
  @IsString()
  @IsNotEmpty()
  content: string;

  @ApiProperty({
    description: 'Parent reply ID (for nested replies)',
    example: 'reply-uuid',
    required: false,
  })
  @IsString()
  @IsOptional()
  parentId?: string;
}

export class AddReactionDto {
  @ApiProperty({
    description: 'Emoji reaction',
    example: '👍',
  })
  @IsString()
  @IsNotEmpty()
  emoji: string;
}
