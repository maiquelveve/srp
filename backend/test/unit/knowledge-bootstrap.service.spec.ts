import { Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { EmbeddingProvider } from '../../src/ai/interfaces/embedding-provider.interface';
import { KnowledgeBootstrapService } from '../../src/knowledge/knowledge-bootstrap.service';

function buildService(rows: unknown[], dimensions = 1024): KnowledgeBootstrapService {
  const dataSource = { query: jest.fn().mockResolvedValue(rows) } as unknown as DataSource;
  const embeddingProvider: EmbeddingProvider = {
    modelId: 'fake:model',
    dimensions,
    embed: jest.fn(),
  };
  return new KnowledgeBootstrapService(dataSource, embeddingProvider);
}

describe('KnowledgeBootstrapService', () => {
  it('passes when the configured dimension matches the column', async () => {
    const service = buildService([{ dimensions: 1024 }], 1024);

    await expect(service.onApplicationBootstrap()).resolves.toBeUndefined();
  });

  it('fails the boot when the dimension differs from the column', async () => {
    const service = buildService([{ dimensions: 1024 }], 768);

    await expect(service.onApplicationBootstrap()).rejects.toThrow(
      /EMBEDDING_DIMENSIONS \(768\).*vector\(1024\)/,
    );
  });

  it('does not fail when the table does not exist yet (migrations pending)', async () => {
    const service = buildService([]);

    await expect(service.onApplicationBootstrap()).resolves.toBeUndefined();
  });

  describe('documents indexed with another embedding model', () => {
    function buildWithUpdateResult(updateResult: unknown): KnowledgeBootstrapService {
      const query = jest
        .fn()
        .mockResolvedValueOnce([{ dimensions: 1024 }])
        .mockResolvedValueOnce(updateResult);
      const embeddingProvider: EmbeddingProvider = {
        modelId: 'fake:model',
        dimensions: 1024,
        embed: jest.fn(),
      };
      return new KnowledgeBootstrapService({ query } as unknown as DataSource, embeddingProvider);
    }

    it('warns with how many documents were marked, from the driver [rows, count] result', async () => {
      const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
      const service = buildWithUpdateResult([[{ id: 1 }, { id: 2 }, { id: 3 }], 3]);

      await service.onApplicationBootstrap();

      expect(warn).toHaveBeenCalledWith(expect.stringContaining('3 documento(s)'));
      warn.mockRestore();
    });

    it('stays quiet when no document needed to be marked', async () => {
      const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
      const service = buildWithUpdateResult([[], 0]);

      await service.onApplicationBootstrap();

      expect(warn).not.toHaveBeenCalled();
      warn.mockRestore();
    });
  });
});
