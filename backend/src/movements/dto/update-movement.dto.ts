import { IsInt, IsNotEmpty, IsOptional, IsString } from 'class-validator';

/** PATCH /api/v1/movements/:id body — corrige uma movimentação TEMPORARY ainda em aberto. */
export class UpdateMovementDto {
  @IsOptional()
  @IsInt()
  movementTypeId?: number;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  destinationLocation?: string;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
