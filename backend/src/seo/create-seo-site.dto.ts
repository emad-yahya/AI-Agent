import {
  IsOptional,
  IsString,
  Length,
  Matches,
  MinLength,
} from 'class-validator';

export class CreateSeoSiteDto {
  @IsString()
  @MinLength(2)
  brand: string;

  @IsString()
  @MinLength(3)
  domain: string;

  @IsString()
  @Length(2, 2)
  @Matches(/^[a-zA-Z]{2}$/, { message: 'country must be ISO 3166-1 alpha-2' })
  country: string;

  @IsOptional()
  @IsString()
  @Length(2, 5)
  language?: string;
}
