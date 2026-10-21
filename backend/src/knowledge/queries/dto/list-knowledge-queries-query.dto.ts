import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

/** `GET /api/v1/knowledge/queries?search=&limit=&offset=` */
export class ListKnowledgeQueriesQueryDto {
  /** Substring, sem diferenciar maiúsculas, contra o texto da pergunta. */
  @IsOptional()
  @IsString()
  @MaxLength(1000)
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
