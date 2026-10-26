import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

/** `POST /api/v1/knowledge/documents` (`multipart/form-data`): o arquivo vem via `@UploadedFile()`, fora deste DTO. */
export class CreateKnowledgeDocumentDto {
  /** Nome de exibição; único entre os documentos da base. */
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name: string;
}
