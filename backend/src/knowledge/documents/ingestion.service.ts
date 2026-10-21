import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { DataSource, Repository } from 'typeorm';
import { AiProviderError } from '../../ai/ai-provider.error';
import { EMBEDDING_PROVIDER } from '../../ai/ai.tokens';
import { EmbeddingProvider } from '../../ai/interfaces/embedding-provider.interface';
import { APP_CONFIG } from '../../config/app-config.module';
import { AppConfig } from '../../config/configuration';
import { KnowledgeDocumentChunk } from '../entities/knowledge-document-chunk.entity';
import { KnowledgeDocument, KnowledgeDocumentStatus } from '../entities/knowledge-document.entity';
import { chunkText } from './chunker';
import { KnowledgeFileFormat, TextExtractionError, TextExtractor } from './text-extractor';

/** Códigos gravados em `failureReason` (data-model.md). Nunca carregam texto do documento. */
export type IngestionFailureReason =
  'NO_EXTRACTABLE_TEXT' | 'CORRUPTED_FILE' | 'AI_UNAVAILABLE' | 'UNKNOWN';

@Injectable()
export class IngestionService {
  private readonly logger = new Logger(IngestionService.name);

  constructor(
    @InjectRepository(KnowledgeDocument)
    private readonly documents: Repository<KnowledgeDocument>,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly textExtractor: TextExtractor,
    @Inject(EMBEDDING_PROVIDER) private readonly embeddingProvider: EmbeddingProvider,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  /**
   * Transforma o arquivo de um documento `PROCESSING` em trechos vetorizados.
   * Nunca lança: qualquer erro vira `FAILED` com um código de motivo.
   */
  async process(documentId: number): Promise<void> {
    const document = await this.documents.findOneBy({ id: documentId });
    // Documento excluído ou já tratado enquanto esperava na fila: nada a fazer.
    if (!document || document.status !== KnowledgeDocumentStatus.PROCESSING) {
      return;
    }

    try {
      const buffer = await readFile(join(this.config.knowledge.storagePath, document.filePath));
      const text = await this.textExtractor.extract(
        buffer,
        document.fileFormat as KnowledgeFileFormat,
      );
      const chunks = chunkText(text);

      // O provider já divide em lotes internamente; aqui vai tudo de uma vez.
      const vectors = await this.embeddingProvider.embed(chunks.map((chunk) => chunk.content));

      await this.saveChunksAndMarkReady(document.id, chunks, vectors);
    } catch (error) {
      const reason = this.toFailureReason(error);
      // Só o código do motivo vai para o log, nunca a mensagem (FR-032).
      this.logger.warn(`Ingestão do documento ${document.id} falhou: ${reason}`);
      await this.markFailed(document.id, reason);
    }
  }

  /** Tudo ou nada: ou entram todos os trechos e o documento fica READY, ou nada muda (FR-016). */
  private async saveChunksAndMarkReady(
    documentId: number,
    chunks: ReturnType<typeof chunkText>,
    vectors: number[][],
  ): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const rows = chunks.map((chunk, index) =>
        manager.create(KnowledgeDocumentChunk, {
          document: { id: documentId },
          position: chunk.position,
          content: chunk.content,
          wordCount: chunk.wordCount,
          embedding: vectors[index],
          embeddingModel: this.embeddingProvider.modelId,
        }),
      );
      await manager.save(rows);
      await manager.update(KnowledgeDocument, documentId, {
        status: KnowledgeDocumentStatus.READY,
        chunkCount: rows.length,
        failureReason: null,
      });
    });
  }

  private async markFailed(documentId: number, reason: IngestionFailureReason): Promise<void> {
    await this.documents.update(documentId, {
      status: KnowledgeDocumentStatus.FAILED,
      failureReason: reason,
    });
  }

  private toFailureReason(error: unknown): IngestionFailureReason {
    if (error instanceof TextExtractionError) {
      return error.reason;
    }
    if (error instanceof AiProviderError) {
      return 'AI_UNAVAILABLE';
    }
    return 'UNKNOWN';
  }
}
