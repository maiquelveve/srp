import { IsISO8601, IsInt, IsNotEmpty, IsOptional, IsString } from 'class-validator';

/**
 * POST /api/v1/movements/final/reversal body — contracts/movements.md (FR-016a).
 * Reverte liberdade/tornozeleira/transferência registrada por engano: o preso
 * volta a ACTIVE na cela `destinationCellId` (com vaga). `reason` é obrigatório
 * (FR-008a).
 */
export class FinalReversalDto {
  @IsInt()
  inmateId: number;

  @IsInt()
  destinationCellId: number;

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
