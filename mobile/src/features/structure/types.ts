export interface Unit {
  id: number;
  name: string;
  code: string | null;
}

export interface Gallery {
  id: number;
  unitId: number;
  code: string;
}

export interface Cell {
  id: number;
  galleryId: number;
  code: string;
  capacity: number;
  occupancy: number;
}

export interface CurrentMovement {
  movementId: number;
  movementTypeName: string;
  exitDateTime: string;
}

export interface Inmate {
  id: number;
  name: string;
  status: string;
  currentCellId: number;
  inMovement: boolean;
  currentMovement: CurrentMovement | null;
}

export interface Paginated<T> {
  data: T[];
  total: number;
}
