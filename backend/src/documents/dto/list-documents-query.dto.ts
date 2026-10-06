import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

/**
 * GET /api/v1/documents?documentTypeId=&search=&limit=&offset= — `documentTypeId`
 * agora opcional (omitido = todas as categorias, tela "Biblioteca de
 * Documentos") além do uso original filtrado por categoria (contracts/documents.md).
 */
export class ListDocumentsQueryDto {
  @IsOptional()
  @IsInt()
  documentTypeId?: number;

  /** Substring, case-insensitive, contra o nome de exibição do documento. */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  offset?: number;
}
