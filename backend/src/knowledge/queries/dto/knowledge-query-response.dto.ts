import {
  KnowledgeQuery,
  KnowledgeQueryOutcome,
  KnowledgeQuerySource,
} from '../../entities/knowledge-query.entity';

export class KnowledgeQueryAuthorDto {
  id: number;
  name: string;
}

/** Nunca expõe `failureKind`: é diagnóstico interno, não algo que a tela mostre como erro. */
export class KnowledgeQueryResponseDto {
  id: number;
  question: string;
  answer: string;
  outcome: KnowledgeQueryOutcome;
  sources: KnowledgeQuerySource[];
  askedBy: KnowledgeQueryAuthorDto;
  createdAt: Date;

  /** Exige `user` carregado na entidade. */
  static fromEntity(query: KnowledgeQuery): KnowledgeQueryResponseDto {
    const dto = new KnowledgeQueryResponseDto();
    dto.id = query.id;
    dto.question = query.question;
    dto.answer = query.answer;
    dto.outcome = query.outcome;
    dto.sources = query.sources;
    dto.askedBy = { id: query.user.id, name: query.user.name };
    dto.createdAt = query.createdAt;
    return dto;
  }
}
