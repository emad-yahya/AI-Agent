import {
  IsEmail,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  Min,
} from 'class-validator';

export class AlertSettingsDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  alertThreshold?: number;

  @IsOptional()
  @IsEmail()
  alertEmail?: string;

  @IsOptional()
  @IsString()
  @IsUrl()
  webhookUrl?: string;

  @IsOptional()
  @IsIn(['weekly', 'monthly', 'disabled'])
  reportFrequency?: 'weekly' | 'monthly' | 'disabled';

  @IsOptional()
  @IsEmail()
  reportEmail?: string;
}
