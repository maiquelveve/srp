import { IsISO8601, IsInt, IsNotEmpty, IsOptional, IsString } from 'class-validator';

/**
 * POST /api/v1/movements/final/ankle-monitor body — contracts/movements.md (FR-013).
 * `reason` carries número do dispositivo / empresa responsável; `notes`
 * carries restrições — same free-text mapping reasoning as FinalReleaseDto.
 */
export class FinalAnkleMonitorDto {
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
