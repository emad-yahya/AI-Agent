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

export class CreateContentGapDto {
  @IsString() @MinLength(2) @MaxLength(200) brand!: string;
  @IsString() @MinLength(3) @MaxLength(200) domain!: string;
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @IsString({ each: true })
  queries!: string[];
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  competitorDomains?: string[];
  @IsOptional() @IsString() @Length(2, 5) country?: string;
}

export class PaaDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(5)
  @IsString({ each: true })
  seeds!: string[];
  @IsOptional() @IsString() @Length(2, 5) country?: string;
}

export class ContentBriefDto {
  @IsString() @MinLength(3) @MaxLength(200) query!: string;
  @IsString() @MinLength(2) @MaxLength(200) brand!: string;
  @IsOptional() @IsString() @MaxLength(200) category?: string;
  @IsOptional() @IsString() @Length(2, 5) country?: string;
}
