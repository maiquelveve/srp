import {
  KnowledgeDocument,
  KnowledgeDocumentStatus,
} from '../../entities/knowledge-document.entity';

export class KnowledgeDocumentAuthorDto {
  id: number;
  name: string;
}

/** Nunca expõe `filePath` nem `pendingFilePath` (contracts/knowledge-api.md). */
export class KnowledgeDocumentResponseDto {
  id: number;
  name: string;
  fileFormat: string;
  originalFileName: string;
  sizeBytes: number;
  status: KnowledgeDocumentStatus;
  failureReason: string | null;
  chunkCount: number;
  uploadedBy: KnowledgeDocumentAuthorDto;
  createdAt: Date;
  updatedAt: Date;

  /** Exige `uploadedBy` carregado na entidade. */
  static fromEntity(document: KnowledgeDocument): KnowledgeDocumentResponseDto {
    const dto = new KnowledgeDocumentResponseDto();
    dto.id = document.id;
    dto.name = document.name;
    dto.fileFormat = document.fileFormat;
    dto.originalFileName = document.originalFileName;
    dto.sizeBytes = document.sizeBytes;
    dto.status = document.status;
    dto.failureReason = document.failureReason;
    dto.chunkCount = document.chunkCount;
    dto.uploadedBy = { id: document.uploadedBy.id, name: document.uploadedBy.name };
    dto.createdAt = document.createdAt;
    dto.updatedAt = document.updatedAt;
    return dto;
  }
}
