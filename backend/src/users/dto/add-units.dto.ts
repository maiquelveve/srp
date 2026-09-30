import { ArrayMaxSize, ArrayNotEmpty, IsArray, IsInt } from 'class-validator';

/** POST /api/v1/users/:id/units — "Adicionar lotação" (FR-006a): soma à lotação atual. */
export class AddUnitsDto {
  /** Máximo 3 lotações simultâneas no total (checagem real, pós-soma, em UsersService.addUnits()). */
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(3)
  @IsInt({ each: true })
  unitIds: number[];
}
