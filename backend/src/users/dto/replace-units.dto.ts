import { ArrayMaxSize, ArrayNotEmpty, IsArray, IsInt } from 'class-validator';

/** PUT /api/v1/users/:id/units — "Trocar lotação" (FR-006): substitui a lotação atual. */
export class ReplaceUnitsDto {
  /** Máximo 3 lotações simultâneas (checagem real em UsersService.replaceUnits()). */
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(3)
  @IsInt({ each: true })
  unitIds: number[];
}
