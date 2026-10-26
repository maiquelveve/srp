import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { EMBEDDING_PROVIDER } from '../../src/ai/ai.tokens';
import { AppModule } from '../../src/app.module';
import { IngestionQueue } from '../../src/knowledge/documents/ingestion-queue';
import { KnowledgeBootstrapService } from '../../src/knowledge/knowledge-bootstrap.service';
import { FakeEmbeddingProvider } from './fakes/fake-embedding.provider';
import { TEST_FIXTURE } from './fixtures';

/**
 * contracts/flows.md, "Recuperação no boot": documento READY indexado com outro modelo de
 * embeddings vira NEEDS_REPROCESS e deixa de ser recuperado. O boot é refeito chamando o
 * hook do bootstrap, depois de simular a troca do modelo no banco.
 */
describe('Knowledge embedding model change', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let queue: IngestionQueue;
  const embeddingProvider = new FakeEmbeddingProvider(1024);
  let wardenToken: string;
  const runPrefix = `T047-${Date.now()}`;
  const TEXT = 'saxofone trombone clarinete flauta oboe fagote';

  async function upload(name: string): Promise<number> {
    const res = await request(app.getHttpServer())
      .post('/api/v1/knowledge/documents')
      .set('Authorization', `Bearer ${wardenToken}`)
      .field('name', name)
      .attach('file', Buffer.from(TEXT, 'utf8'), 'sopro.txt');
    await queue.waitForIdle();
    return (res.body as { id: number }).id;
  }

  async function statusOf(id: number): Promise<string> {
    const rows: Array<{ status: string }> = await dataSource.query(
      'SELECT status FROM knowledge_documents WHERE id = $1',
      [id],
    );
    return rows[0].status;
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(EMBEDDING_PROVIDER)
      .useValue(embeddingProvider)
      .compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();
    dataSource = app.get(DataSource);
    queue = app.get(IngestionQueue);
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: TEST_FIXTURE.wardenEmail, password: TEST_FIXTURE.password });
    wardenToken = (login.body as { accessToken: string }).accessToken;
  });

  afterAll(async () => {
    await queue.waitForIdle();
    await dataSource.query('DELETE FROM knowledge_documents WHERE name LIKE $1', [`${runPrefix}%`]);
    await app.close();
  });

  it('marks READY documents indexed with another model as NEEDS_REPROCESS on boot', async () => {
    const stale = await upload(`${runPrefix}-antigo`);
    const current = await upload(`${runPrefix}-atual`);
    await dataSource.query(
      `UPDATE knowledge_document_chunks SET embedding_model = 'modelo:antigo' WHERE document_id = $1`,
      [stale],
    );

    await app.get(KnowledgeBootstrapService).onApplicationBootstrap();

    expect(await statusOf(stale)).toBe('NEEDS_REPROCESS');
    expect(await statusOf(current)).toBe('READY');
  });

  it('stops retrieving a document once it needs reprocessing', async () => {
    const id = await upload(`${runPrefix}-recuperacao`);
    const retrievable = async (): Promise<number> => {
      const rows: Array<{ total: string }> = await dataSource.query(
        `SELECT COUNT(*) AS total FROM knowledge_document_chunks c
           JOIN knowledge_documents d ON d.id = c.document_id
          WHERE d.id = $1 AND d.status IN ('READY', 'UPDATING') AND c.embedding_model = $2`,
        [id, embeddingProvider.modelId],
      );
      return Number(rows[0].total);
    };
    expect(await retrievable()).toBeGreaterThan(0);

    await dataSource.query(
      `UPDATE knowledge_document_chunks SET embedding_model = 'modelo:antigo' WHERE document_id = $1`,
      [id],
    );
    await app.get(KnowledgeBootstrapService).onApplicationBootstrap();

    expect(await statusOf(id)).toBe('NEEDS_REPROCESS');
    expect(await retrievable()).toBe(0);
  });
});
