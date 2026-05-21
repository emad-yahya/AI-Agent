import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export type ScanMode = 'quick' | 'full';

export class CreateScanDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  brand: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  category: string;

  // 'quick' = 5 prompts (default, ~2 min). 'full' = 30 prompts for wide
  // GEO coverage across services/locations/budgets (~6 min).
  @IsOptional()
  @IsIn(['quick', 'full'])
  mode?: ScanMode;

  // Stored on the scan doc so any device can rebuild the full scan view
  // (action plan / Google panels need domain + country).
  @IsOptional()
  @IsString()
  domain?: string;

  @IsOptional()
  @IsString()
  country?: string;
}
