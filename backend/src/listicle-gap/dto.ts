import {
  ArrayMaxSize,
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class CreateListicleGapDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  brand: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  category: string;

  // Optional list of known competitors (from a recent AI scan). When omitted,
  // the service falls back to extracting brand names from scraped articles.
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(20)
  competitors?: string[];

  // Optional country for Serper geo-targeted search (e.g. 'ae' for UAE)
  @IsOptional()
  @IsString()
  country?: string;
}
