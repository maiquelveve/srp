import { IsEnum, IsInt, IsOptional } from 'class-validator';
import { InmateStatus } from '../entities/inmate.entity';

/** GET /api/v1/inmates?unitId=&galleryId=&cellId=&status= (FR-007, FR-011). */
export class ListInmatesQueryDto {
  @IsOptional()
  @IsInt()
  unitId?: number;

  @IsOptional()
  @IsInt()
  galleryId?: number;

  @IsOptional()
  @IsInt()
  cellId?: number;

  @IsOptional()
  @IsEnum(InmateStatus)
  status?: InmateStatus;
}
