import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsString, Max, Min } from 'class-validator';

export class CreateReviewDto {
  @ApiProperty({
    description: 'Rating from 1 to 5 stars (can be decimal)',
    example: 4.5,
    minimum: 1,
    maximum: 5,
  })
  @IsNumber()
  @Min(1)
  @Max(5)
  rating: number;

  @ApiProperty({
    description: 'Review message',
    example: 'Great work! Very professional and delivered on time.',
  })
  @IsString()
  @IsNotEmpty()
  message: string;
}

export class ReviewResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  rating: number;

  @ApiProperty()
  message: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty()
  reviewerId: string;

  @ApiProperty({
    type: 'object',
    properties: {
      id: { type: 'string' },
      username: { type: 'string' },
      firstName: { type: 'string' },
      lastName: { type: 'string' },
      profilePicture: { type: 'string' },
      role: { type: 'string' },
    },
  })
  reviewer: {
    id: string;
    username: string;
    firstName: string;
    lastName: string;
    profilePicture: string;
    role: string;
  };
}
