export type MovementCategory = 'TEMPORARY' | 'PERMANENT';

export interface MovementType {
  id: number;
  name: string;
  category: MovementCategory;
  description: string | null;
}

export interface Movement {
  id: number;
  inmateId: number;
  movementTypeId: number;
  movementTypeName: string;
  originCellId: number;
  destinationLocation: string;
  reason: string | null;
  notes: string | null;
  exitDateTime: string;
  returnDateTime: string | null;
  userId: number;
  createdAt: string;
}
