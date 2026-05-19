import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsOptional,
  IsString,
  Length,
  MaxLength,
  MinLength,
} from 'class-validator';

export class AnalyzeSiteDto {
  @IsString() @MinLength(3) @MaxLength(200) domain!: string;
  @IsOptional() @IsString() @Length(2, 5) country?: string;
}

export class StartOnboardingDto {
  @IsString() @MinLength(2) @MaxLength(200) brand!: string;
  @IsString() @MinLength(3) @MaxLength(200) domain!: string;
  @IsString() @MinLength(2) @MaxLength(200) category!: string;
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(6)
  @IsString({ each: true })
  competitors!: string[];
  @IsOptional() @IsString() @Length(2, 5) country?: string;
}
