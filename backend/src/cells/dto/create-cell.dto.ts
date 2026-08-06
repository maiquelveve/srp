import { IsInt, IsNotEmpty, IsOptional, IsString, Min, MaxLength } from 'class-validator';

export class CreateCellDto {
  @IsInt()
  galleryId: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  code: string;

  @IsInt()
  @Min(0)
  capacity: number;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  type?: string;
}
