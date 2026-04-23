import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class CreateScanDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  brand: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  category: string;
}
