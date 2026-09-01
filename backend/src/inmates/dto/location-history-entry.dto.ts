import { CellHistoryReason, InmateCellHistory } from '../entities/inmate-cell-history.entity';

/** One row of GET /api/v1/inmates/:id/location-history — contracts/movements.md (FR-016). */
export class LocationHistoryEntryDto {
  cellId: number;
  cellCode: string;
  galleryCode: string;
  unitId: number;
  unitName: string;
  entryDate: Date;
  exitDate: Date | null;
  reason: CellHistoryReason | null;

  static fromEntity(entry: InmateCellHistory): LocationHistoryEntryDto {
    const dto = new LocationHistoryEntryDto();
    dto.cellId = entry.cell.id;
    dto.cellCode = entry.cell.code;
    dto.galleryCode = entry.cell.gallery.code;
    dto.unitId = entry.cell.gallery.unit.id;
    dto.unitName = entry.cell.gallery.unit.name;
    dto.entryDate = entry.entryDate;
    dto.exitDate = entry.exitDate;
    dto.reason = entry.reason;
    return dto;
  }
}
