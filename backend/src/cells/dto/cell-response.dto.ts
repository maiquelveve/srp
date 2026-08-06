import { Cell } from '../entities/cell.entity';

export class CellResponseDto {
  id: number;
  galleryId: number;
  code: string;
  capacity: number;
  type: string | null;
  active: boolean;
  /** Computed from inmates.current_cell_id — never stored directly (contracts/structure.md). */
  occupancy: number;

  static fromEntity(cell: Cell, occupancy: number): CellResponseDto {
    const dto = new CellResponseDto();
    dto.id = cell.id;
    dto.galleryId = cell.gallery.id;
    dto.code = cell.code;
    dto.capacity = cell.capacity;
    dto.type = cell.type;
    dto.active = cell.active;
    dto.occupancy = occupancy;
    return dto;
  }
}
