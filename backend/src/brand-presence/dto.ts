import {
  ArrayMaxSize,
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class CreateBrandPresenceDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  brand: string;

  // Competitor brand names (NOT domains). Max 6 to keep external API calls bounded.
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(6)
  competitors: string[];

  // Optional country for Serper geo (e.g. 'ae' for UAE). Knowledge Panels can
  // differ by country (e.g. local franchise vs global brand).
  @IsOptional()
  @IsString()
  country?: string;
}
