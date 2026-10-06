import { DocumentType } from '../entities/document-type.entity';

export class DocumentTypeResponseDto {
  id: number;
  code: string;
  label: string;

  static fromEntity(documentType: DocumentType): DocumentTypeResponseDto {
    const dto = new DocumentTypeResponseDto();
    dto.id = documentType.id;
    dto.code = documentType.code;
    dto.label = documentType.label;
    return dto;
  }
}
