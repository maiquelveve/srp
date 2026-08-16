import { Movement } from '../entities/movement.entity';

export class MovementResponseDto {
  id: number;
  inmateId: number;
  movementTypeId: number;
  movementTypeName: string;
  originCellId: number;
  destinationLocation: string;
  reason: string | null;
  notes: string | null;
  exitDateTime: Date;
  returnDateTime: Date | null;
  userId: number;
  createdAt: Date;

  static fromEntity(movement: Movement): MovementResponseDto {
    const dto = new MovementResponseDto();
    dto.id = movement.id;
    dto.inmateId = movement.inmate.id;
    dto.movementTypeId = movement.movementType.id;
    dto.movementTypeName = movement.movementType.name;
    dto.originCellId = movement.originCell.id;
    dto.destinationLocation = movement.destinationLocation;
    dto.reason = movement.reason;
    dto.notes = movement.notes;
    dto.exitDateTime = movement.exitDateTime;
    dto.returnDateTime = movement.returnDateTime;
    dto.userId = movement.user.id;
    dto.createdAt = movement.createdAt;
    return dto;
  }
}
