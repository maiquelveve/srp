import { IsISO8601, IsOptional } from 'class-validator';

/** PATCH /api/v1/movements/:id/return body — contracts/movements.md (FR-009). */
export class ReturnMovementDto {
  /** Only for offline-submitted returns — actual moment of return on the device, not on sync (FR-011a). */
  @IsOptional()
  @IsISO8601()
  returnDateTime?: string;
}
