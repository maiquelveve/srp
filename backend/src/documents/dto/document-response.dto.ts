import { Document } from '../entities/document.entity';

export class DocumentResponseDto {
  id: number;
  name: string;
  originalFileName: string;
  sizeBytes: number;
  documentTypeId: number;
  createdAt: Date;

  static fromEntity(document: Document): DocumentResponseDto {
    const dto = new DocumentResponseDto();
    dto.id = document.id;
    dto.name = document.name;
    dto.originalFileName = document.originalFileName;
    dto.sizeBytes = document.sizeBytes;
    dto.documentTypeId = document.documentType.id;
    dto.createdAt = document.createdAt;
    return dto;
  }
}
