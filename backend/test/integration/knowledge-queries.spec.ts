import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AiProviderErrorKind } from '../../src/ai/ai-provider.error';
import { CHAT_PROVIDER, EMBEDDING_PROVIDER } from '../../src/ai/ai.tokens';
import { AppModule } from '../../src/app.module';
import { IngestionQueue } from '../../src/knowledge/documents/ingestion-queue';
import { FakeChatProvider } from './fakes/fake-chat.provider';
import { FakeEmbeddingProvider } from './fakes/fake-embedding.provider';
import { TEST_FIXTURE } from './fixtures';

/**
 * Textos curtos de propósito: o embedding falso soma 1 por palavra e normaliza,
 * então a similaridade por cosseno depende de quantas palavras a pergunta divide
 * com o trecho. Com 7 palavras no trecho e 5 delas na pergunta, o cosseno fica
 * perto de 0,85, bem acima do limiar de 0,45. Cada documento usa um vocabulário
 * próprio para os testes não interferirem entre si nem com os outros arquivos.
 */
const ESCORTA_TEXT = 'zelador carcereiro escolta hospitalar algemas viatura prontuario';
const ESCORTA_QUESTION = 'escolta hospitalar algemas viatura carcereiro';
const UNRELATED_QUESTION = 'qual é a capital da frança';

const QUIMERA_TEXT = 'quimera labirinto minotauro fenix grifo hidra';
const QUIMERA_QUESTION = 'quimera labirinto minotauro fenix';

const NO_ANSWER_MESSAGE = 'Não foi possível encontrar a resposta';
const RATE_LIMIT_PER_MINUTE = 30; // KNOWLEDGE_QUERY_RATE_LIMIT em env-setup.ts

interface QueryBody {
  id: number;
  question: string;
  answer: string;
  outcome: 'ANSWERED' | 'NO_ANSWER' | 'EXCERPTS_ONLY';
  sources: Array<{ documentId: number; documentName: string; position: number; excerpt: string }>;
  askedBy: { id: number; name: string };
  createdAt: string;
  failureKind?: string;
}

/**
 * contracts/knowledge-api.md (POST /knowledge/queries) e contracts/flows.md
 * (fluxo de consulta). Usa embedding e chat falsos (sem rede) e a fila real de ingestão.
 */
describe('Knowledge queries', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let queue: IngestionQueue;
  const embeddingProvider = new FakeEmbeddingProvider(1024);
  const chatProvider = new FakeChatProvider();
  let wardenToken: string;
  let supervisorToken: string;
  let officerToken: string;
  const runPrefix = `T039-${Date.now()}`;
  let nameCounter = 0;
  let escortaDocumentId: number;
  let escortaDocumentName: string;

  async function login(email: string): Promise<string> {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password: TEST_FIXTURE.password });
    return (res.body as { accessToken: string }).accessToken;
  }

  /** Envia um TXT e espera a fila terminar: ao voltar, o documento já está READY com trechos. */
  async function uploadReadyDocument(text: string): Promise<{ id: number; name: string }> {
    const name = `${runPrefix}-${(nameCounter += 1)}`;
    const res = await request(app.getHttpServer())
      .post('/api/v1/knowledge/documents')
      .set('Authorization', `Bearer ${wardenToken}`)
      .field('name', name)
      .attach('file', Buffer.from(text, 'utf8'), 'texto.txt');
    expect(res.status).toBe(202);
    await queue.waitForIdle();
    return { id: (res.body as { id: number }).id, name };
  }

  function ask(token: string, question: unknown): request.Test {
    return request(app.getHttpServer())
      .post('/api/v1/knowledge/queries')
      .set('Authorization', `Bearer ${token}`)
      .send({ question });
  }

  async function countQueriesBy(email: string): Promise<number> {
    const rows: Array<{ total: string }> = await dataSource.query(
      `SELECT COUNT(*) AS total FROM knowledge_queries q
         JOIN users u ON u.id = q.user_id WHERE u.email = $1`,
      [email],
    );
    return Number(rows[0].total);
  }

  async function findPersisted(id: number): Promise<{
    question: string;
    answer: string;
    outcome: string;
    sources: QueryBody['sources'];
    failure_kind: string | null;
  }> {
    const rows = await dataSource.query(
      'SELECT question, answer, outcome, sources, failure_kind FROM knowledge_queries WHERE id = $1',
      [id],
    );
    return rows[0];
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(EMBEDDING_PROVIDER)
      .useValue(embeddingProvider)
      .overrideProvider(CHAT_PROVIDER)
      .useValue(chatProvider)
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

    const escorta = await uploadReadyDocument(ESCORTA_TEXT);
    escortaDocumentId = escorta.id;
    escortaDocumentName = escorta.name;
    // Zera as chamadas da ingestão: os testes conferem só o que a consulta enviou à IA.
    embeddingProvider.reset();
  });

  beforeEach(() => {
    embeddingProvider.reset();
    chatProvider.reset();
  });

  afterAll(async () => {
    await queue.waitForIdle();
    // Trechos saem junto (cascade). `knowledge_queries` é imutável e fica até a próxima preparação do banco de teste.
    await dataSource.query('DELETE FROM knowledge_documents WHERE name LIKE $1', [`${runPrefix}%`]);
    await app.close();
  });

  describe('POST /api/v1/knowledge/queries', () => {
    it('answers with ANSWERED, the sources used, and persists the record', async () => {
      chatProvider.respondWith('A escolta hospitalar exige algemas, conforme o documento.');

      const res = await ask(wardenToken, ESCORTA_QUESTION);

      expect(res.status).toBe(201);
      const body = res.body as QueryBody;
      expect(body).toMatchObject({
        question: ESCORTA_QUESTION,
        answer: 'A escolta hospitalar exige algemas, conforme o documento.',
        outcome: 'ANSWERED',
      });
      expect(body.askedBy.id).toEqual(expect.any(Number));
      expect(body.askedBy.name).toEqual(expect.any(String));
      expect(body.sources).toHaveLength(1);
      expect(body.sources[0]).toMatchObject({
        documentId: escortaDocumentId,
        documentName: escortaDocumentName,
        excerpt: expect.stringContaining('escolta hospitalar'),
      });
      expect(body.sources[0].position).toEqual(expect.any(Number));
      // failureKind é diagnóstico interno e nunca sai na resposta.
      expect(body).not.toHaveProperty('failureKind');

      const persisted = await findPersisted(body.id);
      expect(persisted).toMatchObject({
        question: ESCORTA_QUESTION,
        outcome: 'ANSWERED',
        failure_kind: null,
      });
      expect(persisted.sources).toEqual(body.sources);
    });

    it('sends the question and the retrieved excerpts to the chat, with the safety rules', async () => {
      await ask(wardenToken, ESCORTA_QUESTION);

      expect(chatProvider.requests).toHaveLength(1);
      const { systemPrompt, userPrompt } = chatProvider.requests[0];
      expect(systemPrompt).toContain('[SEM_RESPOSTA]');
      expect(userPrompt).toContain(`<trecho documento="${escortaDocumentName}"`);
      expect(userPrompt).toContain('escolta hospitalar');
      expect(userPrompt).toContain(`Pergunta: ${ESCORTA_QUESTION}`);
    });

    it('answers NO_ANSWER without calling the chat when no excerpt reaches the threshold', async () => {
      const res = await ask(wardenToken, UNRELATED_QUESTION);

      expect(res.status).toBe(201);
      const body = res.body as QueryBody;
      expect(body).toMatchObject({ outcome: 'NO_ANSWER', answer: NO_ANSWER_MESSAGE, sources: [] });
      expect(chatProvider.requests).toHaveLength(0);
      // Mesmo sem resposta, a consulta entra no histórico (FR-023).
      expect((await findPersisted(body.id)).outcome).toBe('NO_ANSWER');
    });

    it('answers NO_ANSWER when the chat replies with the [SEM_RESPOSTA] marker', async () => {
      chatProvider.respondWith('[SEM_RESPOSTA]');

      const res = await ask(wardenToken, ESCORTA_QUESTION);

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        outcome: 'NO_ANSWER',
        answer: NO_ANSWER_MESSAGE,
        sources: [],
      });
      expect(chatProvider.requests).toHaveLength(1);
    });

    it.each<AiProviderErrorKind>([
      'RATE_LIMIT',
      'QUOTA_OR_AUTH',
      'UNAVAILABLE',
      'TIMEOUT',
      'INVALID_RESPONSE',
    ])('falls back to EXCERPTS_ONLY, still 201, when the chat fails with %s', async (kind) => {
      chatProvider.failWith(kind);

      const res = await ask(wardenToken, ESCORTA_QUESTION);

      expect(res.status).toBe(201);
      const body = res.body as QueryBody;
      expect(body.outcome).toBe('EXCERPTS_ONLY');
      expect(body.answer).toContain('Trechos mais relevantes encontrados:');
      expect(body.answer).toContain(`[1] ${escortaDocumentName}`);
      expect(body.answer).toContain('escolta hospitalar');
      expect(body.sources).toHaveLength(1);
      // O tipo da falha fica gravado para diagnóstico, mas não vai na resposta.
      expect(body).not.toHaveProperty('failureKind');
      expect((await findPersisted(body.id)).failure_kind).toBe(kind);
    });

    it('answers 503 and persists nothing when the embedding provider fails', async () => {
      embeddingProvider.failWith('UNAVAILABLE');
      const before = await countQueriesBy(TEST_FIXTURE.wardenEmail);

      const res = await ask(wardenToken, ESCORTA_QUESTION);

      expect(res.status).toBe(503);
      expect(chatProvider.requests).toHaveLength(0);
      expect(await countQueriesBy(TEST_FIXTURE.wardenEmail)).toBe(before);
    });

    it.each([
      ['empty', ''],
      ['only spaces', '     '],
      ['too short after trim', '  oi  '],
      ['too long', 'a'.repeat(1001)],
      ['not a string', 42],
    ])(
      'rejects a question that is %s with 400, without calling the AI or persisting',
      async (_label, question) => {
        const before = await countQueriesBy(TEST_FIXTURE.wardenEmail);

        const res = await ask(wardenToken, question);

        expect(res.status).toBe(400);
        expect(embeddingProvider.calls).toHaveLength(0);
        expect(chatProvider.requests).toHaveLength(0);
        expect(await countQueriesBy(TEST_FIXTURE.wardenEmail)).toBe(before);
      },
    );

    it('lets SUPERVISOR ask too', async () => {
      const res = await ask(supervisorToken, ESCORTA_QUESTION);
      expect(res.status).toBe(201);
    });

    it('rejects PRISON_OFFICER with 403', async () => {
      const res = await ask(officerToken, ESCORTA_QUESTION);
      expect(res.status).toBe(403);
      expect(embeddingProvider.calls).toHaveLength(0);
    });

    it('rejects a request without token with 401', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/knowledge/queries')
        .send({ question: ESCORTA_QUESTION });
      expect(res.status).toBe(401);
    });

    it('answers 429 once the user exceeds the per-minute limit, without affecting other users', async () => {
      const rows: Array<{ id: number }> = await dataSource.query(
        'SELECT id FROM users WHERE email = $1',
        [TEST_FIXTURE.supervisorEmail],
      );
      // Preenche o histórico recente do Supervisor até o limite, direto no banco.
      for (let index = 0; index < RATE_LIMIT_PER_MINUTE; index += 1) {
        await dataSource.query(
          `INSERT INTO knowledge_queries (user_id, question, answer, outcome, sources)
           VALUES ($1, 'pergunta de preenchimento', 'resposta', 'NO_ANSWER', '[]')`,
          [rows[0].id],
        );
      }
      const supervisorBefore = await countQueriesBy(TEST_FIXTURE.supervisorEmail);

      const limited = await ask(supervisorToken, ESCORTA_QUESTION);

      expect(limited.status).toBe(429);
      // O limite é checado antes de gastar IA e nada é gravado.
      expect(embeddingProvider.calls).toHaveLength(0);
      expect(chatProvider.requests).toHaveLength(0);
      expect(await countQueriesBy(TEST_FIXTURE.supervisorEmail)).toBe(supervisorBefore);

      // Outro usuário continua podendo perguntar.
      const other = await ask(wardenToken, ESCORTA_QUESTION);
      expect(other.status).toBe(201);
    });
  });

  describe('retrieval', () => {
    it('only uses READY and UPDATING documents, and chunks of the current embedding model', async () => {
      const quimera = await uploadReadyDocument(QUIMERA_TEXT);
      embeddingProvider.reset();

      const setStatus = (status: string): Promise<unknown> =>
        dataSource.query('UPDATE knowledge_documents SET status = $1 WHERE id = $2', [
          status,
          quimera.id,
        ]);

      // READY: entra na recuperação.
      const ready = await ask(wardenToken, QUIMERA_QUESTION);
      expect((ready.body as QueryBody).outcome).toBe('ANSWERED');
      expect((ready.body as QueryBody).sources[0].documentId).toBe(quimera.id);

      // NEEDS_REPROCESS e FAILED: ficam de fora, mesmo com os trechos ainda no banco.
      for (const excluded of ['NEEDS_REPROCESS', 'FAILED']) {
        await setStatus(excluded);
        chatProvider.reset();
        const res = await ask(wardenToken, QUIMERA_QUESTION);
        expect(res.body).toMatchObject({ outcome: 'NO_ANSWER', sources: [] });
        expect(chatProvider.requests).toHaveLength(0);
      }

      // UPDATING: os trechos antigos continuam respondendo durante a atualização.
      await setStatus('UPDATING');
      const updating = await ask(wardenToken, QUIMERA_QUESTION);
      expect((updating.body as QueryBody).outcome).toBe('ANSWERED');

      // Trecho gerado por outro modelo de embedding não é comparável: fica de fora.
      await setStatus('READY');
      await dataSource.query(
        `UPDATE knowledge_document_chunks SET embedding_model = 'outro:modelo' WHERE document_id = $1`,
        [quimera.id],
      );
      const otherModel = await ask(wardenToken, QUIMERA_QUESTION);
      expect(otherModel.body).toMatchObject({ outcome: 'NO_ANSWER', sources: [] });
    });
  });
});
