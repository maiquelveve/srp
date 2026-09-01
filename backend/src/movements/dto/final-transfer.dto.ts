import { IsISO8601, IsInt, IsNotEmpty, IsOptional, IsString } from 'class-validator';

/**
 * POST /api/v1/movements/final/transfer body — contracts/movements.md (FR-014).
 * research.md #35 — `destinationLocation` dropped; unidade de destino,
 * escolta e referência documental viram texto livre dentro de `reason`/
 * `notes`, mesma forma exata de FinalReleaseDto/FinalAnkleMonitorDto.
 */
export class FinalTransferDto {
  @IsInt()
  inmateId: number;

  @IsString()
  @IsNotEmpty()
  reason: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsISO8601()
  exitDateTime?: string;
}
