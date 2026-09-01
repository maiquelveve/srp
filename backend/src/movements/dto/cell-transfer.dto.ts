import { IsISO8601, IsInt, IsNotEmpty, IsOptional, IsString } from 'class-validator';

/**
 * Shared body for the four troca/permuta endpoints (research.md #35,
 * FR-015–FR-015c) — `POST /movements/cell-change`, `/cell-swap`,
 * `/gallery-change`, `/gallery-swap`. Same shape in all four; what differs
 * is endpoint-level behavior (same gallery vs. different, single move vs.
 * simultaneous swap), not the payload. `originCellId` is not accepted —
 * derived server-side from `inmate.currentCell`. For `*-swap`,
 * `destinationCellId` is the cell currently occupied by the *other* inmate,
 * and `destinationInmateId` (REQUIRED for `*-swap`, ignored otherwise) is
 * that inmate specifically — a shared cell can hold more than one ACTIVE
 * inmate, so "whoever's in that cell" is ambiguous; the client MUST have
 * listed the cell's occupants beforehand (`GET /inmates?cellId=&status=ACTIVE`)
 * and let the user pick which one.
 */
export class CellTransferDto {
  @IsInt()
  inmateId: number;

  @IsInt()
  destinationCellId: number;

  @IsOptional()
  @IsInt()
  destinationInmateId?: number;

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
