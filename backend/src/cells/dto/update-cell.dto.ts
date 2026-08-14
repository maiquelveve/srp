import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, Min, MaxLength } from 'class-validator';
import { CellType } from '../entities/cell.entity';

export class UpdateCellDto {
  @IsOptional()
  @IsString()
  @MaxLength(20)
  code?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  capacity?: number;

  @IsOptional()
  @IsEnum(CellType)
  type?: CellType;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
