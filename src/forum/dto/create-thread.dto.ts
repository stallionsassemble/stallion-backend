import { IsArray, IsBoolean, IsOptional, IsString } from 'class-validator';

export class CreateThreadDto {
  @IsString()
  title: string;

  @IsString()
  slug: string;

  @IsString()
  categoryId: string;

  @IsString()
  content: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsBoolean()
  isPinned?: boolean;
}
