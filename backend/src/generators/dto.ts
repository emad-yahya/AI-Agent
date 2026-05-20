import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class FaqItemDto {
  @IsString()
  @MinLength(5)
  @MaxLength(300)
  question!: string;

  @IsString()
  @MinLength(10)
  @MaxLength(1500)
  answer!: string;
}

export class GenerateFaqSchemaDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => FaqItemDto)
  items!: FaqItemDto[];
}

export class GenerateFaqFromPaaDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @IsString({ each: true })
  questions!: string[];

  @IsString() @MinLength(2) @MaxLength(200) brand!: string;
  @IsOptional() @IsString() @MaxLength(200) category?: string;
}

export class SocialProfilesDto {
  @IsOptional() @IsUrl() linkedin?: string;
  @IsOptional() @IsUrl() facebook?: string;
  @IsOptional() @IsUrl() twitter?: string;
  @IsOptional() @IsUrl() instagram?: string;
  @IsOptional() @IsUrl() youtube?: string;
  @IsOptional() @IsUrl() wikipedia?: string;
  @IsOptional() @IsUrl() crunchbase?: string;
}

export class AddressDto {
  @IsString() @MaxLength(200) streetAddress!: string;
  @IsString() @MaxLength(100) addressLocality!: string;
  @IsOptional() @IsString() @MaxLength(100) addressRegion?: string;
  @IsOptional() @IsString() @MaxLength(30) postalCode?: string;
  @IsString() @MaxLength(80) addressCountry!: string;
}

export class GenerateOrgSchemaDto {
  @IsIn(['Organization', 'LocalBusiness', 'RealEstateAgent', 'Store', 'Restaurant', 'ProfessionalService'])
  type!: string;

  @IsString() @MinLength(2) @MaxLength(200) name!: string;
  @IsUrl() url!: string;
  @IsOptional() @IsUrl() logo?: string;
  @IsOptional() @IsString() @MaxLength(500) description?: string;
  @IsOptional() @IsString() @MaxLength(40) telephone?: string;
  @IsOptional() @IsEmail() email?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => AddressDto)
  address?: AddressDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => SocialProfilesDto)
  social?: SocialProfilesDto;
}

export class GenerateArticleSchemaDto {
  @IsString() @MinLength(5) @MaxLength(300) headline!: string;
  @IsUrl() url!: string;
  @IsOptional() @IsUrl() image?: string;
  @IsString() @MinLength(2) @MaxLength(120) authorName!: string;
  @IsOptional() @IsUrl() authorUrl?: string;
  @IsString() @MinLength(2) @MaxLength(120) publisherName!: string;
  @IsOptional() @IsUrl() publisherLogo?: string;
  @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @IsOptional() @IsString() datePublished?: string;
  @IsOptional() @IsString() dateModified?: string;
}

export class ReviewItemDto {
  @IsString() @MinLength(2) @MaxLength(120) author!: string;
  @IsString() @MinLength(5) @MaxLength(1000) reviewBody!: string;
  @IsString() rating!: string;
}

export class GenerateReviewSchemaDto {
  @IsString() @MinLength(2) @MaxLength(200) itemName!: string;
  @IsString() ratingValue!: string;
  @IsString() reviewCount!: string;
  @IsArray()
  @ArrayMinSize(0)
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => ReviewItemDto)
  reviews!: ReviewItemDto[];
}

export class GenerateLlmsTxtDto {
  @IsString() @MinLength(2) @MaxLength(200) siteName!: string;
  @IsUrl() siteUrl!: string;
  @IsString() @MinLength(10) @MaxLength(800) summary!: string;
  @IsOptional() @IsString() @MaxLength(2000) details?: string;
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => LlmsLinkDto)
  primaryLinks?: LlmsLinkDto[];
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => LlmsLinkDto)
  optionalLinks?: LlmsLinkDto[];
  @IsOptional() @IsEmail() contactEmail?: string;
}

export class LlmsLinkDto {
  @IsString() @MinLength(2) @MaxLength(120) title!: string;
  @IsUrl() url!: string;
  @IsOptional() @IsString() @MaxLength(300) description?: string;
}

export class GenerateRobotsPatchDto {
  @IsOptional() @IsString() @MaxLength(20000) existingRobotsTxt?: string;
  @IsOptional() @IsUrl() sitemapUrl?: string;
}
