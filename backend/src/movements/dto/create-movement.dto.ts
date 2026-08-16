import { IsInt, IsISO8601, IsNotEmpty, IsOptional, IsString } from 'class-validator';

/** POST /api/v1/movements body — contracts/movements.md (FR-008). */
export class CreateMovementDto {
  @IsInt()
  inmateId: number;

  @IsInt()
  movementTypeId: number;

  @IsInt()
  originCellId: number;

  /** Obrigatório — rastreabilidade de para onde o preso foi é o propósito central da Movimentação (research.md #26). */
  @IsString()
  @IsNotEmpty()
  destinationLocation: string;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  /** Only for offline-submitted movements — actual moment of exit on the device, not on sync (FR-011a). */
  @IsOptional()
  @IsISO8601()
  exitDateTime?: string;
}
