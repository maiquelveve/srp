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

export interface Inmate {
  id: number;
  name: string;
  status: string;
  currentCellId: number;
  inMovement: boolean;
}

export interface Paginated<T> {
  data: T[];
  total: number;
}
