import {
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export const CONTENT_PLATFORMS = [
  'gmb',
  'linkedin',
  'blog',
  'twitter',
] as const;
export type ContentPlatform = (typeof CONTENT_PLATFORMS)[number];

export class GenerateContentDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  brand: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  category: string;

  @IsIn(CONTENT_PLATFORMS)
  platform: ContentPlatform;

  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  topic: string;

  @IsOptional()
  @IsNumber()
  mentionRate?: number;

  @IsOptional()
  @IsNumber()
  avgScore?: number;
}
