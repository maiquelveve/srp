import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { readFile, unlink } from 'node:fs/promises';
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
   * Transforma o arquivo de um documento `PROCESSING` ou `UPDATING` em trechos vetorizados.
   * Nunca lança: em `PROCESSING` o erro vira `FAILED`; em `UPDATING` o documento volta a
   * `READY` com a versão anterior intacta e o motivo em `failureReason`.
   */
  async process(documentId: number): Promise<void> {
    const document = await this.documents.findOneBy({ id: documentId });
    // Documento excluído ou já tratado enquanto esperava na fila: nada a fazer.
    if (
      !document ||
      (document.status !== KnowledgeDocumentStatus.PROCESSING &&
        document.status !== KnowledgeDocumentStatus.UPDATING)
    ) {
      return;
    }
    const isUpdate = document.status === KnowledgeDocumentStatus.UPDATING;

    try {
      // Na atualização o conteúdo novo está no arquivo pendente; o atual segue valendo até a troca.
      const sourcePath = isUpdate ? document.pendingFilePath : document.filePath;
      if (!sourcePath) {
        throw new Error('Documento em atualização sem arquivo pendente');
      }
      const fileFormat = isUpdate ? this.formatFromPath(sourcePath) : document.fileFormat;

      const buffer = await readFile(join(this.config.knowledge.storagePath, sourcePath));
      const text = await this.textExtractor.extract(buffer, fileFormat as KnowledgeFileFormat);
      const chunks = chunkText(text);

      // O provider já divide em lotes internamente; aqui vai tudo de uma vez.
      const vectors = await this.embeddingProvider.embed(chunks.map((chunk) => chunk.content));

      const replacedFilePath = await this.saveChunksAndMarkReady(
        document,
        chunks,
        vectors,
        isUpdate ? { fileFormat, sizeBytes: buffer.length } : null,
      );
      // Só depois do commit: se a troca falhasse, o arquivo antigo ainda seria necessário.
      if (replacedFilePath) {
        await this.removeFile(replacedFilePath);
      }
    } catch (error) {
      const reason = this.toFailureReason(error);
      // Só o código do motivo vai para o log, nunca a mensagem (FR-032).
      this.logger.warn(`Ingestão do documento ${document.id} falhou: ${reason}`);
      if (isUpdate) {
        await this.revertFailedUpdate(document, reason);
      } else {
        await this.markFailed(document.id, reason);
      }
    }
  }

  /**
   * Tudo ou nada: ou entram todos os trechos e o documento fica READY, ou nada muda (FR-016).
   * Os trechos antigos saem na mesma transação, então a busca nunca vê o documento sem trechos.
   * Devolve o arquivo substituído (só na atualização) para o chamador apagar após o commit.
   */
  private async saveChunksAndMarkReady(
    document: KnowledgeDocument,
    chunks: ReturnType<typeof chunkText>,
    vectors: number[][],
    newFile: { fileFormat: string; sizeBytes: number } | null,
  ): Promise<string | null> {
    await this.dataSource.transaction(async (manager) => {
      // Reprocessar um documento "Precisa reprocessar" deixa trechos do modelo antigo para trás.
      await manager
        .createQueryBuilder()
        .delete()
        .from(KnowledgeDocumentChunk)
        .where('document_id = :documentId', { documentId: document.id })
        .execute();
      const rows = chunks.map((chunk, index) =>
        manager.create(KnowledgeDocumentChunk, {
          document: { id: document.id },
          position: chunk.position,
          content: chunk.content,
          wordCount: chunk.wordCount,
          embedding: vectors[index],
          embeddingModel: this.embeddingProvider.modelId,
        }),
      );
      await manager.save(rows);
      await manager.update(KnowledgeDocument, document.id, {
        status: KnowledgeDocumentStatus.READY,
        chunkCount: rows.length,
        failureReason: null,
        ...(newFile && {
          filePath: document.pendingFilePath as string,
          originalFileName: document.pendingOriginalFileName ?? document.originalFileName,
          fileFormat: newFile.fileFormat,
          sizeBytes: newFile.sizeBytes,
          pendingFilePath: null,
          pendingOriginalFileName: null,
        }),
      });
    });
    return newFile ? document.filePath : null;
  }

  /** A atualização falhou: descarta o arquivo novo e devolve o documento, com a versão antiga, a READY. */
  private async revertFailedUpdate(
    document: KnowledgeDocument,
    reason: IngestionFailureReason,
  ): Promise<void> {
    await this.documents.update(document.id, {
      status: KnowledgeDocumentStatus.READY,
      failureReason: reason,
      pendingFilePath: null,
      pendingOriginalFileName: null,
    });
    if (document.pendingFilePath) {
      await this.removeFile(document.pendingFilePath);
    }
  }

  private async markFailed(documentId: number, reason: IngestionFailureReason): Promise<void> {
    await this.documents.update(documentId, {
      status: KnowledgeDocumentStatus.FAILED,
      failureReason: reason,
    });
  }

  /** Falha ao apagar arquivo só vira log: o estado do documento já está certo. */
  private async removeFile(relativePath: string): Promise<void> {
    await unlink(join(this.config.knowledge.storagePath, relativePath)).catch(() => {
      this.logger.warn('Não foi possível remover um arquivo de documento do disco');
    });
  }

  /** O arquivo é gravado como `<uuid>.<formato>`; a extensão é o formato detectado no envio. */
  private formatFromPath(relativePath: string): string {
    return relativePath.slice(relativePath.lastIndexOf('.') + 1);
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
