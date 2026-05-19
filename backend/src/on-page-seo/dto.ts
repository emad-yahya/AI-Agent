import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateOnPageSeoScanDto {
  @IsString() @MinLength(2) @MaxLength(200) brand!: string;
  @IsString() @MinLength(3) @MaxLength(200) domain!: string;
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsUrl({ require_protocol: true }, { each: true })
  pages?: string[];
  @IsOptional()
  @IsIn(['mobile', 'desktop'])
  strategy?: 'mobile' | 'desktop';
}
