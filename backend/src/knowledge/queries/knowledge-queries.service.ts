import {
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { AiProviderError } from '../../ai/ai-provider.error';
import { CHAT_PROVIDER, EMBEDDING_PROVIDER } from '../../ai/ai.tokens';
import { ChatProvider } from '../../ai/interfaces/chat-provider.interface';
import { EmbeddingProvider } from '../../ai/interfaces/embedding-provider.interface';
import { APP_CONFIG } from '../../config/app-config.module';
import { AppConfig } from '../../config/configuration';
import { vectorTransformer } from '../entities/knowledge-document-chunk.entity';
import {
  KnowledgeQuery,
  KnowledgeQueryOutcome,
  KnowledgeQuerySource,
} from '../entities/knowledge-query.entity';
import { User } from '../../users/entities/user.entity';
import { KnowledgeQueryResponseDto } from './dto/knowledge-query-response.dto';
import {
  buildPrompt,
  formatRawExcerpts,
  NO_ANSWER_MARKER,
  NO_ANSWER_MESSAGE,
  PromptChunk,
} from './prompt-builder';

/** Quantos trechos a busca traz no máximo (contracts/flows.md). */
const RETRIEVAL_LIMIT = 5;
/** Janela do limite de consultas por usuário. */
const RATE_LIMIT_WINDOW_SECONDS = 60;
const EMBEDDING_UNAVAILABLE_MESSAGE =
  'Não foi possível processar a pergunta agora. Tente novamente em instantes.';
const RATE_LIMIT_MESSAGE =
  'Você fez muitas perguntas em pouco tempo. Aguarde um minuto e tente novamente.';

/** Trecho recuperado: o que o prompt precisa mais o id do documento, para o snapshot das fontes. */
export interface RetrievedChunk extends PromptChunk {
  documentId: number;
  /** 1 - distância de cosseno: 1 = idêntico, 0 = sem relação. */
  similarity: number;
}

@Injectable()
export class KnowledgeQueriesService {
  private readonly minSimilarity: number;
  private readonly queryRateLimit: number;

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(KnowledgeQuery) private readonly queries: Repository<KnowledgeQuery>,
    @Inject(EMBEDDING_PROVIDER) private readonly embeddingProvider: EmbeddingProvider,
    @Inject(CHAT_PROVIDER) private readonly chatProvider: ChatProvider,
    @Inject(APP_CONFIG) config: AppConfig,
  ) {
    this.minSimilarity = config.knowledge.minSimilarity;
    this.queryRateLimit = config.knowledge.queryRateLimit;
  }

  /**
   * Fluxo de consulta (contracts/flows.md). Toda consulta que chega ao fim é gravada
   * no histórico, inclusive as sem resposta; as que falham antes (400, 429, 503) não são.
   */
  async ask(question: string, userId: number): Promise<KnowledgeQueryResponseDto> {
    // Antes de gastar qualquer chamada de IA.
    await this.enforceRateLimit(userId);

    const questionVector = await this.embedQuestion(question);
    const chunks = await this.retrieveRelevantChunks(questionVector);

    // Nada relevante: nem chama o chat (economiza tempo, custo e evita resposta inventada).
    if (chunks.length === 0) {
      return this.saveAndRespond(userId, question, {
        outcome: KnowledgeQueryOutcome.NO_ANSWER,
        answer: NO_ANSWER_MESSAGE,
        sources: [],
      });
    }

    const sources = this.toSources(chunks);
    let generatedText: string;
    try {
      generatedText = (await this.chatProvider.generate(buildPrompt(question, chunks))).text;
    } catch (error) {
      if (!(error instanceof AiProviderError)) {
        throw error;
      }
      // A IA de chat caiu, mas a busca funcionou: entrega os trechos brutos (FR-008).
      return this.saveAndRespond(userId, question, {
        outcome: KnowledgeQueryOutcome.EXCERPTS_ONLY,
        answer: formatRawExcerpts(chunks),
        sources,
        failureKind: error.kind,
      });
    }

    // A IA disse que os trechos não respondem: tratado como "sem resposta", sem fontes.
    if (generatedText.includes(NO_ANSWER_MARKER)) {
      return this.saveAndRespond(userId, question, {
        outcome: KnowledgeQueryOutcome.NO_ANSWER,
        answer: NO_ANSWER_MESSAGE,
        sources: [],
      });
    }

    return this.saveAndRespond(userId, question, {
      outcome: KnowledgeQueryOutcome.ANSWERED,
      answer: generatedText.trim(),
      sources,
    });
  }

  /**
   * Limite por usuário (FR-010): conta as consultas gravadas no último minuto. Não usa
   * `@Throttle` porque o `ThrottlerGuard` roda antes do `JwtAuthGuard` e não saberia
   * quem é o usuário (research.md #11). Duas perguntas simultâneas podem passar juntas
   * pela contagem; para um teto de ~10 por minuto isso é aceitável.
   */
  private async enforceRateLimit(userId: number): Promise<void> {
    const recent = await this.queries
      .createQueryBuilder('query')
      .where('query.user_id = :userId', { userId })
      .andWhere(`query.created_at > NOW() - INTERVAL '${RATE_LIMIT_WINDOW_SECONDS} seconds'`)
      .getCount();
    if (recent >= this.queryRateLimit) {
      throw new HttpException(RATE_LIMIT_MESSAGE, HttpStatus.TOO_MANY_REQUESTS);
    }
  }

  /** Sem o vetor da pergunta não há busca, nem trechos brutos: devolve 503 e nada é gravado. */
  private async embedQuestion(question: string): Promise<number[]> {
    try {
      const [vector] = await this.embeddingProvider.embed([question]);
      return vector;
    } catch (error) {
      if (error instanceof AiProviderError) {
        throw new ServiceUnavailableException(EMBEDDING_UNAVAILABLE_MESSAGE);
      }
      throw error;
    }
  }

  /** Cópia do que foi usado: sobrevive à exclusão ou atualização do documento (FR-026). */
  private toSources(chunks: RetrievedChunk[]): KnowledgeQuerySource[] {
    return chunks.map((chunk) => ({
      documentId: chunk.documentId,
      documentName: chunk.documentName,
      position: chunk.position,
      excerpt: chunk.content,
    }));
  }

  private async saveAndRespond(
    userId: number,
    question: string,
    result: {
      outcome: KnowledgeQueryOutcome;
      answer: string;
      sources: KnowledgeQuerySource[];
      failureKind?: string;
    },
  ): Promise<KnowledgeQueryResponseDto> {
    const saved = await this.queries.save(
      this.queries.create({
        user: { id: userId } as User,
        question,
        answer: result.answer,
        outcome: result.outcome,
        sources: result.sources,
        failureKind: result.failureKind ?? null,
      }),
    );
    // Recarrega com o autor: a resposta traz `askedBy` (nome do usuário).
    const withAuthor = await this.queries.findOneOrFail({
      where: { id: saved.id },
      relations: { user: true },
    });
    return KnowledgeQueryResponseDto.fromEntity(withAuthor);
  }

  /**
   * Os trechos mais parecidos com o vetor da pergunta (T042, data-model.md).
   *
   * - `<=>` é a distância de cosseno do pgvector; `1 - distância` vira a similaridade.
   * - Só entram documentos `READY` e `UPDATING` (em `UPDATING` os trechos antigos
   *   seguem valendo até a troca) e trechos do modelo de embedding atual: vetores
   *   de modelos diferentes não se comparam.
   * - O `LIMIT 5` usa o índice HNSW; o corte por similaridade mínima é feito depois,
   *   em memória, porque o índice só ordena e não filtra por nota.
   */
  async retrieveRelevantChunks(questionVector: number[]): Promise<RetrievedChunk[]> {
    const rows: Array<{
      document_id: number;
      document_name: string;
      position: number;
      content: string;
      similarity: number;
    }> = await this.dataSource.query(
      `SELECT d.id AS document_id, d.name AS document_name, c.position, c.content,
              1 - (c.embedding <=> $1::vector) AS similarity
         FROM knowledge_document_chunks c
         JOIN knowledge_documents d ON d.id = c.document_id
        WHERE d.status IN ('READY', 'UPDATING') AND c.embedding_model = $2
        ORDER BY c.embedding <=> $1::vector
        LIMIT ${RETRIEVAL_LIMIT}`,
      [vectorTransformer.to(questionVector), this.embeddingProvider.modelId],
    );

    return rows
      .map((row) => ({
        documentId: row.document_id,
        documentName: row.document_name,
        position: row.position,
        content: row.content,
        similarity: Number(row.similarity),
      }))
      .filter((chunk) => chunk.similarity >= this.minSimilarity);
  }
}
