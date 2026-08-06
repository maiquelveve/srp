import { Inmate, InmateStatus } from '../entities/inmate.entity';

export class InmateResponseDto {
  id: number;
  name: string;
  registrationId: string | null;
  birthDate: string | null;
  custodyRegime: string | null;
  photoUrl: string | null;
  status: InmateStatus;
  currentCellId: number;
  /** True while an open (unreturned) temporary Movement exists (FR-011). */
  inMovement: boolean;

  static fromEntity(inmate: Inmate, inMovement: boolean): InmateResponseDto {
    const dto = new InmateResponseDto();
    dto.id = inmate.id;
    dto.name = inmate.name;
    dto.registrationId = inmate.registrationId;
    dto.birthDate = inmate.birthDate;
    dto.custodyRegime = inmate.custodyRegime;
    dto.photoUrl = inmate.photoUrl;
    dto.status = inmate.status;
    dto.currentCellId = inmate.currentCell.id;
    dto.inMovement = inMovement;
    return dto;
  }
}
