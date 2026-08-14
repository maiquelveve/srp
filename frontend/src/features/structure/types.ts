export type RoleName = 'PRISON_OFFICER' | 'SUPERVISOR' | 'WARDEN';

export type InmateStatus = 'ACTIVE' | 'RELEASED' | 'ANKLE_MONITOR' | 'TRANSFERRED' | 'DECEASED';

export type GalleryType = 'MALE' | 'FEMALE';

export type CellType = 'SHARED' | 'INDIVIDUAL';

export interface Unit {
  id: number;
  name: string;
  code: string | null;
  address: string | null;
  phone: string | null;
  active: boolean;
}

export interface Gallery {
  id: number;
  unitId: number;
  code: string;
  description: string | null;
  type: GalleryType;
  active: boolean;
}

export interface Cell {
  id: number;
  galleryId: number;
  code: string;
  capacity: number;
  type: CellType;
  active: boolean;
  occupancy: number;
}

export interface Inmate {
  id: number;
  name: string;
  registrationId: string | null;
  birthDate: string | null;
  custodyRegime: string | null;
  photoUrl: string | null;
  status: InmateStatus;
  currentCellId: number;
  inMovement: boolean;
}

export interface Paginated<T> {
  data: T[];
  total: number;
}
