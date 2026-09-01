import { IsISO8601, IsInt, IsNotEmpty, IsOptional, IsString } from 'class-validator';

/**
 * POST /api/v1/movements/final/release body — contracts/movements.md (FR-012).
 * `reason` carries alvará nº / unidade judiciária / agente responsável — the
 * generic `Movement.reason` free-text column, no dedicated columns added
 * (data-model.md is authoritative and defines only reason/notes here).
 */
export class FinalReleaseDto {
  @IsInt()
  inmateId: number;

  @IsString()
  @IsNotEmpty()
  reason: string;

  @IsOptional()
  @IsString()
  notes?: string;

  /** Only for offline-submitted registrations — actual moment on the device. */
  @IsOptional()
  @IsISO8601()
  exitDateTime?: string;
}
