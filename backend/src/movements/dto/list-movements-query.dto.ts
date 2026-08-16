import { IsBooleanString, IsInt, IsOptional } from 'class-validator';

/** GET /api/v1/movements?inmateId=&open=true — contracts/movements.md. */
export class ListMovementsQueryDto {
  @IsOptional()
  @IsInt()
  inmateId?: number;

  /** Query strings arrive as text — validated/parsed as a boolean, not a real boolean. */
  @IsOptional()
  @IsBooleanString()
  open?: string;
}
