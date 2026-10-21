import { readFileSync } from 'fs';
import { join } from 'path';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { EMBEDDING_PROVIDER } from '../../src/ai/ai.tokens';
import { AppModule } from '../../src/app.module';
import { IngestionQueue } from '../../src/knowledge/documents/ingestion-queue';
import { FakeEmbeddingProvider } from './fakes/fake-embedding.provider';
import { TEST_FIXTURE } from './fixtures';

const FIXTURES_DIR = join(__dirname, 'fixtures', 'knowledge');
const readFixture = (fileName: string): Buffer => readFileSync(join(FIXTURES_DIR, fileName));

const TXT_BUFFER = readFixture('sample.txt');
const PDF_BUFFER = readFixture('with-text.pdf');
const DOCX_BUFFER = readFixture('sample.docx');
const PDF_WITHOUT_TEXT_BUFFER = readFixture('no-text.pdf');
/** Executável (MZ) com extensão trocada para .pdf. */
const EXE_DISGUISED_AS_PDF = Buffer.concat([
  Buffer.from([0x4d, 0x5a]),
  Buffer.from([0x90, 0x00, 0x03, 0x00, 0x00, 0x00, 0x04, 0x00]),
]);
/** Cabeçalho de .doc legado (Compound File + stream WordDocument): reconhecido como `doc`, que a base não aceita. */
const DOC_BUFFER = Buffer.concat([
  Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]),
  Buffer.from('resto de um .doc legado ', 'latin1'),
  Buffer.from('WordDocument', 'utf16le'),
]);
/** Acima do DOCUMENTS_MAX_FILE_SIZE_MB=1 definido em env-setup.ts. */
const OVERSIZED_TXT_BUFFER = Buffer.alloc(1.5 * 1024 * 1024, 'a');

interface DocumentBody {
  id: number;
  name: string;
  status: string;
  failureReason: string | null;
  chunkCount: number;
  fileFormat: string;
  filePath?: string;
}

/**
 * contracts/knowledge-api.md: envio e ingestão de documentos da base de
 * conhecimento. Usa o EmbeddingProvider falso (sem rede) e a fila real,
 * aguardada com `waitForIdle()`.
 */
describe('Knowledge documents upload and ingestion', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let queue: IngestionQueue;
  const embeddingProvider = new FakeEmbeddingProvider(1024);
  let wardenToken: string;
  let supervisorToken: string;
  let officerToken: string;
  /** Prefixo único por execução: os nomes são únicos na base e o teste limpa só o que criou. */
  const runPrefix = `T028-${Date.now()}`;
  let nameCounter = 0;

  const uniqueName = (): string => `${runPrefix}-${(nameCounter += 1)}`;

  async function login(email: string): Promise<string> {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password: TEST_FIXTURE.password });
    return (res.body as { accessToken: string }).accessToken;
  }

  function upload(
    token: string,
    options: { name?: string; fileName: string; buffer: Buffer },
  ): request.Test {
    return request(app.getHttpServer())
      .post('/api/v1/knowledge/documents')
      .set('Authorization', `Bearer ${token}`)
      .field('name', options.name ?? uniqueName())
      .attach('file', options.buffer, options.fileName);
  }

  async function findDocument(id: number): Promise<DocumentBody> {
    const res = await request(app.getHttpServer())
      .get('/api/v1/knowledge/documents')
      .query({ search: runPrefix, limit: 100 })
      .set('Authorization', `Bearer ${wardenToken}`);
    const found = (res.body as { data: DocumentBody[] }).data.find((item) => item.id === id);
    if (!found) {
      throw new Error(`Documento ${id} não apareceu na listagem`);
    }
    return found;
  }

  async function countChunks(documentId: number): Promise<number> {
    const rows: Array<{ total: string }> = await dataSource.query(
      'SELECT COUNT(*) AS total FROM knowledge_document_chunks WHERE document_id = $1',
      [documentId],
    );
    return Number(rows[0].total);
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
  });

  afterEach(() => {
    embeddingProvider.reset();
  });

  afterAll(async () => {
    await queue.waitForIdle();
    // Trechos saem junto (cascade). A auditoria é imutável e fica.
    await dataSource.query('DELETE FROM knowledge_documents WHERE name LIKE $1', [`${runPrefix}%`]);
    await app.close();
  });

  describe('POST /api/v1/knowledge/documents', () => {
    it.each([
      ['TXT', 'regras.txt', TXT_BUFFER, 'txt'],
      ['PDF', 'regras.pdf', PDF_BUFFER, 'pdf'],
      ['DOCX', 'regras.docx', DOCX_BUFFER, 'docx'],
    ])(
      'accepts a %s, answers 202 and ends READY with chunks',
      async (_label, fileName, buffer, format) => {
        const res = await upload(wardenToken, { fileName, buffer });

        expect(res.status).toBe(202);
        const body = res.body as DocumentBody;
        expect(body).toMatchObject({ status: 'PROCESSING', fileFormat: format, chunkCount: 0 });
        // O caminho do arquivo no disco nunca é exposto.
        expect(body).not.toHaveProperty('filePath');

        await queue.waitForIdle();

        const processed = await findDocument(body.id);
        expect(processed.status).toBe('READY');
        expect(processed.chunkCount).toBeGreaterThan(0);
        expect(await countChunks(body.id)).toBe(processed.chunkCount);
      },
    );

    it('lets SUPERVISOR upload too', async () => {
      const res = await upload(supervisorToken, { fileName: 'regras.txt', buffer: TXT_BUFFER });
      expect(res.status).toBe(202);
      await queue.waitForIdle();
    });

    it('rejects PRISON_OFFICER with 403', async () => {
      const res = await upload(officerToken, { fileName: 'regras.txt', buffer: TXT_BUFFER });
      expect(res.status).toBe(403);
    });

    it('rejects a request without token with 401', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/knowledge/documents')
        .field('name', uniqueName())
        .attach('file', TXT_BUFFER, 'regras.txt');
      expect(res.status).toBe(401);
    });

    it('rejects content that does not match the extension with 400', async () => {
      const res = await upload(wardenToken, {
        fileName: 'falso.pdf',
        buffer: EXE_DISGUISED_AS_PDF,
      });
      expect(res.status).toBe(400);
    });

    it('rejects .doc with 400', async () => {
      const res = await upload(wardenToken, { fileName: 'antigo.doc', buffer: DOC_BUFFER });
      expect(res.status).toBe(400);
    });

    it('rejects a request without file with 400', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/knowledge/documents')
        .set('Authorization', `Bearer ${wardenToken}`)
        .field('name', uniqueName());
      expect(res.status).toBe(400);
    });

    it('rejects a file above the size limit with 413', async () => {
      const res = await upload(wardenToken, {
        fileName: 'enorme.txt',
        buffer: OVERSIZED_TXT_BUFFER,
      });
      expect(res.status).toBe(413);
    });

    it('rejects a duplicated name with 409', async () => {
      const name = uniqueName();
      const first = await upload(wardenToken, { name, fileName: 'a.txt', buffer: TXT_BUFFER });
      const second = await upload(wardenToken, { name, fileName: 'b.txt', buffer: TXT_BUFFER });

      expect(first.status).toBe(202);
      expect(second.status).toBe(409);
      await queue.waitForIdle();
    });

    it('resolves two simultaneous uploads with the same name into one 202 and one 409', async () => {
      const name = uniqueName();
      const responses = await Promise.all([
        upload(wardenToken, { name, fileName: 'a.txt', buffer: TXT_BUFFER }),
        upload(wardenToken, { name, fileName: 'b.txt', buffer: TXT_BUFFER }),
      ]);

      expect(responses.map((res) => res.status).sort()).toEqual([202, 409]);
      await queue.waitForIdle();
    });

    it('marks a PDF without text as FAILED(NO_EXTRACTABLE_TEXT), with no chunks', async () => {
      const res = await upload(wardenToken, {
        fileName: 'escaneado.pdf',
        buffer: PDF_WITHOUT_TEXT_BUFFER,
      });
      const { id } = res.body as DocumentBody;
      await queue.waitForIdle();

      const processed = await findDocument(id);
      expect(processed).toMatchObject({
        status: 'FAILED',
        failureReason: 'NO_EXTRACTABLE_TEXT',
        chunkCount: 0,
      });
      expect(await countChunks(id)).toBe(0);
    });

    it('marks the document FAILED(AI_UNAVAILABLE) with no partial chunks when embeddings fail', async () => {
      embeddingProvider.failWith('UNAVAILABLE');

      const res = await upload(wardenToken, { fileName: 'regras.txt', buffer: TXT_BUFFER });
      const { id } = res.body as DocumentBody;
      await queue.waitForIdle();

      const processed = await findDocument(id);
      expect(processed).toMatchObject({
        status: 'FAILED',
        failureReason: 'AI_UNAVAILABLE',
        chunkCount: 0,
      });
      expect(await countChunks(id)).toBe(0);
    });

    it('records an INSERT audit entry without the document content', async () => {
      const res = await upload(wardenToken, { fileName: 'auditado.txt', buffer: TXT_BUFFER });
      const { id } = res.body as DocumentBody;
      await queue.waitForIdle();

      const rows: Array<{ action: string; new_data: Record<string, unknown> }> =
        await dataSource.query(
          `SELECT action, new_data FROM audit_logs
           WHERE affected_table = 'knowledge_documents' AND record_id = $1`,
          [id],
        );
      expect(rows).toHaveLength(1);
      expect(rows[0].action).toBe('INSERT');
      expect(rows[0].new_data).toMatchObject({
        fileFormat: 'txt',
        originalFileName: 'auditado.txt',
      });
      expect(JSON.stringify(rows[0].new_data)).not.toContain(
        TXT_BUFFER.toString('utf8').slice(0, 30),
      );
    });
  });

  describe('GET /api/v1/knowledge/documents', () => {
    it('lists newest first, filters by name and paginates', async () => {
      const first = await upload(wardenToken, {
        name: `${runPrefix}-lista-a`,
        fileName: 'a.txt',
        buffer: TXT_BUFFER,
      });
      const second = await upload(wardenToken, {
        name: `${runPrefix}-lista-b`,
        fileName: 'b.txt',
        buffer: TXT_BUFFER,
      });
      await queue.waitForIdle();

      const res = await request(app.getHttpServer())
        .get('/api/v1/knowledge/documents')
        .query({ search: `${runPrefix}-lista`, limit: 1, offset: 0 })
        .set('Authorization', `Bearer ${wardenToken}`);

      expect(res.status).toBe(200);
      const body = res.body as { data: DocumentBody[]; total: number };
      expect(body.total).toBe(2);
      expect(body.data).toHaveLength(1);
      expect(body.data[0].id).toBe((second.body as DocumentBody).id);
      expect(body.data[0].id).not.toBe((first.body as DocumentBody).id);
    });

    it('rejects PRISON_OFFICER with 403', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/knowledge/documents')
        .set('Authorization', `Bearer ${officerToken}`);
      expect(res.status).toBe(403);
    });
  });
});
