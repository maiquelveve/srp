import { Gallery, GalleryType } from '../entities/gallery.entity';

export class GalleryResponseDto {
  id: number;
  unitId: number;
  code: string;
  description: string | null;
  type: GalleryType;
  active: boolean;

  static fromEntity(gallery: Gallery): GalleryResponseDto {
    const dto = new GalleryResponseDto();
    dto.id = gallery.id;
    dto.unitId = gallery.unit.id;
    dto.code = gallery.code;
    dto.description = gallery.description;
    dto.type = gallery.type;
    dto.active = gallery.active;
    return dto;
  }
}
