import { Inject, Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { EMBEDDING_PROVIDER } from '../ai/ai.tokens';
import { EmbeddingProvider } from '../ai/interfaces/embedding-provider.interface';

/**
 * Verificações feitas uma vez, quando o backend sobe. Uma configuração que
 * contradiz o banco precisa derrubar o boot: descobri-la só na primeira
 * ingestão deixaria documentos falhando por um motivo difícil de achar.
 */
@Injectable()
export class KnowledgeBootstrapService implements OnApplicationBootstrap {
  private readonly logger = new Logger(KnowledgeBootstrapService.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @Inject(EMBEDDING_PROVIDER) private readonly embeddingProvider: EmbeddingProvider,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.assertEmbeddingDimensionMatchesColumn();
  }

  /**
   * O tamanho do vetor é fixo na coluna `vector(N)`. Se EMBEDDING_DIMENSIONS
   * (ou o modelo) não bater com ele, toda ingestão falharia.
   */
  private async assertEmbeddingDimensionMatchesColumn(): Promise<void> {
    const rows: Array<{ dimensions: number | null }> = await this.dataSource.query(`
      SELECT atttypmod AS dimensions
      FROM pg_attribute
      WHERE attrelid = to_regclass('knowledge_document_chunks') AND attname = 'embedding'
    `);

    if (rows.length === 0) {
      this.logger.warn(
        'A tabela knowledge_document_chunks não existe; rode as migrations para usar a base de conhecimento',
      );
      return;
    }

    const columnDimensions = Number(rows[0].dimensions);
    if (columnDimensions !== this.embeddingProvider.dimensions) {
      throw new Error(
        `EMBEDDING_DIMENSIONS (${this.embeddingProvider.dimensions}) não bate com a coluna ` +
          `knowledge_document_chunks.embedding (vector(${columnDimensions})). ` +
          'Ajuste a variável ou crie uma migration para a nova dimensão e reprocesse os documentos.',
      );
    }
  }
}
