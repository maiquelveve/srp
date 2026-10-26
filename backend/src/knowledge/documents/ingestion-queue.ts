import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { KnowledgeDocument, KnowledgeDocumentStatus } from '../entities/knowledge-document.entity';
import { IngestionService } from './ingestion.service';

/**
 * Fila em memória: processa um documento por vez, na ordem de chegada.
 * Assim vários uploads seguidos não sobrecarregam o provedor de embeddings.
 */
@Injectable()
export class IngestionQueue implements OnApplicationBootstrap {
  private readonly logger = new Logger(IngestionQueue.name);
  private readonly pendingIds: number[] = [];
  private isRunning = false;
  /** Quem chamou `waitForIdle()`; é acordado quando a fila esvazia. */
  private idleWaiters: Array<() => void> = [];

  constructor(
    private readonly ingestionService: IngestionService,
    @InjectRepository(KnowledgeDocument)
    private readonly documents: Repository<KnowledgeDocument>,
  ) {}

  /**
   * A fila vive em memória: se o backend reiniciou no meio de uma ingestão,
   * documentos ficaram presos em PROCESSING/UPDATING. Recoloca todos na fila.
   */
  async onApplicationBootstrap(): Promise<void> {
    const stuck = await this.documents.find({
      select: { id: true },
      where: {
        status: In([KnowledgeDocumentStatus.PROCESSING, KnowledgeDocumentStatus.UPDATING]),
      },
      order: { id: 'ASC' },
    });
    for (const { id } of stuck) {
      this.enqueue(id);
    }
    if (stuck.length > 0) {
      this.logger.log(`${stuck.length} documento(s) pendentes recolocados na fila`);
    }
  }

  enqueue(documentId: number): void {
    if (this.pendingIds.includes(documentId)) {
      return;
    }
    this.pendingIds.push(documentId);
    void this.drain();
  }

  /** Tira da fila um documento que ainda não começou (ex.: foi excluído). */
  cancel(documentId: number): void {
    const index = this.pendingIds.indexOf(documentId);
    if (index !== -1) {
      this.pendingIds.splice(index, 1);
    }
  }

  /** Resolve quando não há mais nada na fila nem em execução. Usado pelos testes. */
  waitForIdle(): Promise<void> {
    if (!this.isRunning && this.pendingIds.length === 0) {
      return Promise.resolve();
    }
    return new Promise((resolve) => this.idleWaiters.push(resolve));
  }

  /** Concorrência 1: se já há um laço rodando, ele mesmo pega os novos ids. */
  private async drain(): Promise<void> {
    if (this.isRunning) {
      return;
    }
    this.isRunning = true;
    try {
      while (this.pendingIds.length > 0) {
        const documentId = this.pendingIds.shift() as number;
        try {
          await this.ingestionService.process(documentId);
        } catch (error) {
          // `process` não deveria lançar, mas um erro aqui não pode travar a fila.
          this.logger.error(`Falha inesperada ao processar o documento ${documentId}`, error);
        }
      }
    } finally {
      this.isRunning = false;
      const waiters = this.idleWaiters;
      this.idleWaiters = [];
      waiters.forEach((resolve) => resolve());
    }
  }
}
