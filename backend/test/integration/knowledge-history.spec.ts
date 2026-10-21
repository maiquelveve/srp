import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { EMBEDDING_PROVIDER } from '../../src/ai/ai.tokens';
import { AppModule } from '../../src/app.module';
import { IngestionQueue } from '../../src/knowledge/documents/ingestion-queue';
import { User } from '../../src/users/entities/user.entity';
import { FakeEmbeddingProvider } from './fakes/fake-embedding.provider';
import { TEST_FIXTURE } from './fixtures';

interface HistoryItem {
  id: number;
  question: string;
  answer: string;
  outcome: string;
  sources: Array<{ documentId: number; documentName: string; position: number; excerpt: string }>;
  askedBy: { id: number; name: string };
  createdAt: string;
}

/**
 * contracts/knowledge-api.md (GET queries) e FR-024/FR-025/FR-026: o histórico lista as
 * consultas de todos os usuários e ninguém consegue alterá-lo ou apagá-lo, nem pela API
 * nem direto no banco.
 */
describe('Knowledge history', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let queue: IngestionQueue;
  const embeddingProvider = new FakeEmbeddingProvider(1024);
  let wardenToken: string;
  let supervisorToken: string;
  let officerToken: string;
  const runPrefix = `T055-${Date.now()}`;
  const FIRST_AUTHOR = 'first';
  const SECOND_AUTHOR = 'second';
  const userIds: Record<string, number> = {};
  const insertedIds: number[] = [];

  async function login(email: string): Promise<string> {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password: TEST_FIXTURE.password });
    return (res.body as { accessToken: string }).accessToken;
  }

  /** Grava direto no banco: o que se testa aqui é a leitura, não o fluxo de perguntar. */
  async function insertQuery(options: {
    author: string;
    question: string;
    answer?: string;
    outcome?: string;
    sources?: unknown[];
    createdAt?: string;
  }): Promise<number> {
    const rows: Array<{ id: number }> = await dataSource.query(
      `INSERT INTO knowledge_queries (user_id, question, answer, outcome, sources, created_at)
       VALUES ($1, $2, $3, $4, $5, COALESCE($6::timestamptz, now())) RETURNING id`,
      [
        userIds[options.author],
        options.question,
        options.answer ?? 'resposta',
        options.outcome ?? 'ANSWERED',
        JSON.stringify(options.sources ?? []),
        options.createdAt ?? null,
      ],
    );
    insertedIds.push(rows[0].id);
    return rows[0].id;
  }

  function history(token: string, query: Record<string, string | number> = {}): request.Test {
    return request(app.getHttpServer())
      .get('/api/v1/knowledge/queries')
      .query({ search: runPrefix, ...query })
      .set('Authorization', `Bearer ${token}`);
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
    wardenToken = await login(TEST_FIXTURE.wardenEmail);
    supervisorToken = await login(TEST_FIXTURE.supervisorEmail);
    officerToken = await login(TEST_FIXTURE.officerEmail);
    // Autores próprios do teste, fora de warden/supervisor: os outros arquivos de teste contam as
    // consultas desses dois (limite por minuto), e rodam em paralelo com este.
    const officer = await dataSource
      .getRepository(User)
      .findOneOrFail({ where: { email: TEST_FIXTURE.officerEmail }, relations: { role: true } });
    const secondAuthor = await dataSource.getRepository(User).save({
      name: `Autor ${runPrefix}`,
      email: `${runPrefix}@test.srp.rs.gov.br`.toLowerCase(),
      passwordHash: officer.passwordHash,
      role: officer.role,
      active: true,
    });
    userIds[FIRST_AUTHOR] = officer.id;
    userIds[SECOND_AUTHOR] = secondAuthor.id;
  });

  afterAll(async () => {
    await queue.waitForIdle();
    await dataSource.query('DELETE FROM knowledge_documents WHERE name LIKE $1', [`${runPrefix}%`]);
    // O histórico é imutável: as linhas do teste ficam, identificadas pelo prefixo da execução.
    await app.close();
  });

  describe('GET /api/v1/knowledge/queries', () => {
    it('lists queries of every user, newest first, with the author and NO_ANSWER included', async () => {
      await insertQuery({
        author: FIRST_AUTHOR,
        question: `${runPrefix} primeira`,
        createdAt: '2026-01-01T10:00:00Z',
      });
      await insertQuery({
        author: SECOND_AUTHOR,
        question: `${runPrefix} segunda`,
        answer: 'Não foi possível encontrar a resposta',
        outcome: 'NO_ANSWER',
        createdAt: '2026-01-02T10:00:00Z',
      });

      const res = await history(wardenToken);

      expect(res.status).toBe(200);
      const body = res.body as { data: HistoryItem[]; total: number };
      expect(body.total).toBe(2);
      expect(body.data.map((item) => item.question)).toEqual([
        `${runPrefix} segunda`,
        `${runPrefix} primeira`,
      ]);
      expect(body.data[0]).toMatchObject({
        outcome: 'NO_ANSWER',
        askedBy: { id: userIds[SECOND_AUTHOR], name: `Autor ${runPrefix}` },
      });
      expect(body.data[1].askedBy.id).toBe(userIds[FIRST_AUTHOR]);
      // `failureKind` é diagnóstico interno e não sai pela API.
      expect(body.data[0]).not.toHaveProperty('failureKind');
    });

    it('is readable by SUPERVISOR too', async () => {
      const res = await history(supervisorToken);
      expect(res.status).toBe(200);
    });

    it('paginates with limit and offset, keeping the total', async () => {
      const page = await history(wardenToken, { limit: 1, offset: 1 });

      const body = page.body as { data: HistoryItem[]; total: number };
      expect(body.total).toBe(2);
      expect(body.data).toHaveLength(1);
      expect(body.data[0].question).toBe(`${runPrefix} primeira`);
    });

    it('filters by a case-insensitive substring of the question', async () => {
      await insertQuery({
        author: FIRST_AUTHOR,
        question: `${runPrefix} Escolta Hospitalar`,
      });

      const res = await history(wardenToken, { search: `${runPrefix} escolta` });

      const body = res.body as { data: HistoryItem[]; total: number };
      expect(body.total).toBe(1);
      expect(body.data[0].question).toBe(`${runPrefix} Escolta Hospitalar`);
    });

    it('treats % and _ in the search literally', async () => {
      const res = await history(wardenToken, { search: `${runPrefix}%` });
      expect((res.body as { total: number }).total).toBe(0);
    });

    it('rejects PRISON_OFFICER with 403 and a request without token with 401', async () => {
      expect((await history(officerToken)).status).toBe(403);
      const noToken = await request(app.getHttpServer()).get('/api/v1/knowledge/queries');
      expect(noToken.status).toBe(401);
    });

    it('rejects an invalid limit with 400', async () => {
      const res = await history(wardenToken, { limit: 1000 });
      expect(res.status).toBe(400);
    });
  });

  describe('immutability', () => {
    it.each(['put', 'patch', 'delete'] as const)(
      'answers 404 to %s /knowledge/queries/:id',
      async (method) => {
        const id = await insertQuery({
          author: FIRST_AUTHOR,
          question: `${runPrefix} imutavel ${method}`,
        });

        const res = await request(app.getHttpServer())
          [method](`/api/v1/knowledge/queries/${id}`)
          .set('Authorization', `Bearer ${wardenToken}`)
          .send({ answer: 'adulterada' });

        expect(res.status).toBe(404);
      },
    );

    it('fails UPDATE, DELETE and TRUNCATE straight on the database', async () => {
      const id = await insertQuery({
        author: FIRST_AUTHOR,
        question: `${runPrefix} protegida`,
      });

      await expect(
        dataSource.query(`UPDATE knowledge_queries SET answer = 'x' WHERE id = $1`, [id]),
      ).rejects.toThrow(/immutable/);
      await expect(
        dataSource.query(`DELETE FROM knowledge_queries WHERE id = $1`, [id]),
      ).rejects.toThrow(/immutable/);
      await expect(dataSource.query('TRUNCATE knowledge_queries')).rejects.toThrow(/immutable/);

      const rows: Array<{ answer: string }> = await dataSource.query(
        'SELECT answer FROM knowledge_queries WHERE id = $1',
        [id],
      );
      expect(rows).toEqual([{ answer: 'resposta' }]);
    });
  });

  describe('after the source document is deleted', () => {
    it('keeps the query and its copied sources in the history', async () => {
      const upload = await request(app.getHttpServer())
        .post('/api/v1/knowledge/documents')
        .set('Authorization', `Bearer ${wardenToken}`)
        .field('name', `${runPrefix}-fonte`)
        .attach('file', Buffer.from('tema unico historico preservado', 'utf8'), 'fonte.txt');
      const documentId = (upload.body as { id: number }).id;
      await queue.waitForIdle();
      const question = `${runPrefix} sobre a fonte`;
      await insertQuery({
        author: FIRST_AUTHOR,
        question,
        sources: [
          {
            documentId,
            documentName: `${runPrefix}-fonte`,
            position: 0,
            excerpt: 'trecho copiado',
          },
        ],
      });

      const deleted = await request(app.getHttpServer())
        .delete(`/api/v1/knowledge/documents/${documentId}`)
        .set('Authorization', `Bearer ${wardenToken}`);
      expect(deleted.status).toBe(204);

      const res = await history(wardenToken, { search: question });
      const body = res.body as { data: HistoryItem[]; total: number };
      expect(body.total).toBe(1);
      expect(body.data[0].sources).toEqual([
        { documentId, documentName: `${runPrefix}-fonte`, position: 0, excerpt: 'trecho copiado' },
      ]);
    });
  });
});
