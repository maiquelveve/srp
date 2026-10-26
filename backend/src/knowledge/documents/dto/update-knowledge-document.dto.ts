import { Transform } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * `PUT /api/v1/knowledge/documents/:id` (`multipart/form-data`): o arquivo vem via
 * `@UploadedFile()`, fora deste DTO. A regra "ao menos `file` ou `name`" é conferida
 * no service, que enxerga os dois.
 */
export class UpdateKnowledgeDocumentDto {
  /** Novo nome de exibição; único entre os documentos da base. */
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name?: string;
}
