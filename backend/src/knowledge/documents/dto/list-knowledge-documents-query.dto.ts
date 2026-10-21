import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

/** `GET /api/v1/knowledge/documents?search=&limit=&offset=` */
export class ListKnowledgeDocumentsQueryDto {
  /** Substring, sem diferenciar maiúsculas, contra o nome do documento. */
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
