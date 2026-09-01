import { Inmate } from '../../inmates/entities/inmate.entity';

/** GET /api/v1/cells/:id/occupant — contracts/movements.md (FR-015a/FR-015c). */
export class CellOccupantResponseDto {
  id: number;
  name: string;
  registrationId: string | null;

  static fromEntity(inmate: Inmate): CellOccupantResponseDto {
    const dto = new CellOccupantResponseDto();
    dto.id = inmate.id;
    dto.name = inmate.name;
    dto.registrationId = inmate.registrationId;
    return dto;
  }
}
