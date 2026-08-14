import { IsEnum, IsInt, IsNotEmpty, IsString, Min, MaxLength } from 'class-validator';
import { CellType } from '../entities/cell.entity';

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

  @IsEnum(CellType)
  type: CellType;
}
