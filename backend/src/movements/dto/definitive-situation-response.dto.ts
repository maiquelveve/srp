import { Movement } from '../entities/movement.entity';
import { InmateStatus } from '../../inmates/entities/inmate.entity';

/** Uma linha da tela "Situações definitivas" (FR-016a): a situação vigente de um preso. */
export class DefinitiveSituationResponseDto {
  movementId: number;
  inmateId: number;
  inmateName: string;
  registrationId: string | null;
  status: InmateStatus;
  /** Nome do tipo de movimentação: Liberdade, Tornozeleira eletrônica ou Transferência. */
  situation: string;
  /** Data e hora do registro da situação. */
  registeredAt: Date;
  registeredByName: string;
  reason: string | null;
  galleryId: number;
  galleryCode: string;
  cellCode: string;

  static fromEntity(movement: Movement): DefinitiveSituationResponseDto {
    const dto = new DefinitiveSituationResponseDto();
    dto.movementId = movement.id;
    dto.inmateId = movement.inmate.id;
    dto.inmateName = movement.inmate.name;
    dto.registrationId = movement.inmate.registrationId;
    dto.status = movement.inmate.status;
    dto.situation = movement.movementType.name;
    dto.registeredAt = movement.exitDateTime;
    dto.registeredByName = movement.user.name;
    dto.reason = movement.reason;
    dto.galleryId = movement.originCell.gallery.id;
    dto.galleryCode = movement.originCell.gallery.code;
    dto.cellCode = movement.originCell.code;
    return dto;
  }
}
