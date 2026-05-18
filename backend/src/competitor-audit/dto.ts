import {
  ArrayMaxSize,
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class CreateCompetitorAuditDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  brand: string;

  // Brand's own website domain or URL (e.g. "platinumsquare.ae" or "https://example.com")
  @IsString()
  @IsNotEmpty()
  brandDomain: string;

  // Competitor identifiers — either bare domains ("bayut.com") or brand names
  // ("Bayut") that will be resolved to domains via Serper. Max 6 to bound time.
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(6)
  competitors: string[];

  // Optional country for Serper geo (e.g. 'ae') when resolving names to domains
  // and when querying indexed-pages count.
  @IsOptional()
  @IsString()
  country?: string;
}
