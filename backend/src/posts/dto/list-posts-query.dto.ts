import { IsBooleanString, IsInt, IsOptional } from 'class-validator';

/** `GET /posts?unitId=&includeInactive=` — contracts/staff.md. */
export class ListPostsQueryDto {
  @IsOptional()
  @IsInt()
  unitId?: number;

  /** Default (unset): só postos ativos, os que podem receber novas escalas. */
  @IsOptional()
  @IsBooleanString()
  includeInactive?: string;
}
