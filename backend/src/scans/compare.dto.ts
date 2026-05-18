import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsNotEmpty,
  IsString,
  MinLength,
} from 'class-validator';

export class CompareDto {
  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(4)
  @IsString({ each: true })
  @MinLength(2, { each: true })
  brands: string[];

  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  category: string;
}
