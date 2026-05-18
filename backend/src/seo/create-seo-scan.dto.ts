import {
  IsArray,
  IsString,
  ArrayMinSize,
  ArrayMaxSize,
  MinLength,
} from 'class-validator';

export class CreateSeoScanDto {
  @IsString()
  @MinLength(2)
  brand: string;

  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  keywords: string[];
}
