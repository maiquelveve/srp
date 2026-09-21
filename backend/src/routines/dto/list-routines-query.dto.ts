import { IsBooleanString, IsDateString, IsIn, IsInt, IsOptional } from 'class-validator';

/**
 * `GET /api/v1/routines?galleryId=&shift=today` (contracts/routines.md,
 * FR-020). `shift=today` is the contract's documented example — `Routine`
 * has no shift concept of its own (only weekday/time), so it is accepted as
 * a literal alias for "use today's date" (already the default when `date`
 * is omitted). `date` additionally accepts any ISO date so a caller can
 * check a specific day's programming (e.g. after deactivating a routine for
 * one date via `PATCH .../activation`, per quickstart.md Cenário 4).
 */
export class ListRoutinesQueryDto {
  @IsOptional()
  @IsInt()
  galleryId?: number;

  @IsOptional()
  @IsDateString()
  date?: string;

  @IsOptional()
  @IsIn(['today'])
  shift?: string;

  /**
   * Default behavior (unset) is the read-only consultation shape (FR-020):
   * only routines actually applicable on the queried date. The web
   * management screen sets this to see and act on every routine of the
   * gallery — including one deactivated for that date — with `active` on
   * the response reflecting its true per-date status instead of being
   * silently dropped from the list (research.md #40 addendum).
   */
  @IsOptional()
  @IsBooleanString()
  includeInactive?: string;
}
