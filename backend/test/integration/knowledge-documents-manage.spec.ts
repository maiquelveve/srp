import { existsSync } from 'fs';
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

const STORAGE_PATH = process.env.KNOWLEDGE_STORAGE_PATH as string;

const OLD_TEXT = 'ancora bussola cordame leme popa proa';
const NEW_TEXT = 'diapasao partitura maestro orquestra violino';

/**
 * Embedding falso que pode ser "segurado": enquanto `hold()` não for liberado, `embed`
 * espera. Deixa o teste olhar o estado do documento no meio da ingestão.
 */
class GatedEmbeddingProvider extends FakeEmbeddingProvider {
  private gate: Promise<void> | null = null;

  hold(): () => void {
    let release!: () => void;
    this.gate = new Promise<void>((resolve) => {
      release = () => {
        this.gate = null;
        resolve();
      };
    });
    return release;
  }

  override async embed(texts: string[]): Promise<number[][]> {
    if (this.gate) {
      await this.gate;
    }
    return super.embed(texts);
  }
}

interface DocumentBody {
  id: number;
  name: string;
  status: string;
  failureReason: string | null;
  chunkCount: number;
  originalFileName: string;
  uploadedBy: { id: number; name: string };
}

/**
 * contracts/knowledge-api.md (PUT, reprocess, DELETE) e contracts/flows.md (atualização e
 * exclusão). Embedding falso e fila real, aguardada com `waitForIdle()`.
 */
describe('Knowledge documents update, reprocess and delete', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let queue: IngestionQueue;
  const embeddingProvider = new GatedEmbeddingProvider(1024);
  let wardenToken: string;
  let supervisorToken: string;
  let officerToken: string;
  let wardenUserId: number;
  const runPrefix = `T046-${Date.now()}`;
  let nameCounter = 0;

  const uniqueName = (): string => `${runPrefix}-${(nameCounter += 1)}`;
  const txt = (text: string): Buffer => Buffer.from(text, 'utf8');
  const authorized = (token: string) => ({ Authorization: `Bearer ${token}` });

  async function login(email: string): Promise<string> {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password: TEST_FIXTURE.password });
    return (res.body as { accessToken: string }).accessToken;
  }

  /** Envia um TXT e espera a ingestão: ao voltar, o documento está READY. */
  async function uploadReady(text = OLD_TEXT, name = uniqueName()): Promise<DocumentBody> {
    const res = await request(app.getHttpServer())
      .post('/api/v1/knowledge/documents')
      .set(authorized(wardenToken))
      .field('name', name)
      .attach('file', txt(text), 'original.txt');
    expect(res.status).toBe(202);
    await queue.waitForIdle();
    return findDocument((res.body as DocumentBody).id);
  }

  function put(
    id: number,
    options: { token?: string; name?: string; file?: { buffer: Buffer; fileName: string } },
  ): request.Test {
    const req = request(app.getHttpServer())
      .put(`/api/v1/knowledge/documents/${id}`)
      .set(authorized(options.token ?? wardenToken));
    if (options.name !== undefined) {
      req.field('name', options.name);
    }
    if (options.file) {
      req.attach('file', options.file.buffer, options.file.fileName);
    }
    return req;
  }

  async function findDocument(id: number): Promise<DocumentBody> {
    const res = await request(app.getHttpServer())
      .get('/api/v1/knowledge/documents')
      .query({ search: runPrefix, limit: 100 })
      .set(authorized(wardenToken));
    const found = (res.body as { data: DocumentBody[] }).data.find((item) => item.id === id);
    if (!found) {
      throw new Error(`Documento ${id} não apareceu na listagem`);
    }
    return found;
  }

  async function chunkContents(documentId: number): Promise<string[]> {
    const rows: Array<{ content: string }> = await dataSource.query(
      'SELECT content FROM knowledge_document_chunks WHERE document_id = $1 ORDER BY position',
      [documentId],
    );
    return rows.map((row) => row.content);
  }

  async function filePaths(
    documentId: number,
  ): Promise<{ file_path: string; pending_file_path: string | null }> {
    const rows = await dataSource.query(
      'SELECT file_path, pending_file_path FROM knowledge_documents WHERE id = $1',
      [documentId],
    );
    return rows[0];
  }

  const fileExists = (relativePath: string): boolean =>
    existsSync(join(STORAGE_PATH, relativePath));

  async function auditEntries(
    documentId: number,
  ): Promise<Array<{ action: string; old_data: unknown; new_data: unknown }>> {
    return dataSource.query(
      `SELECT action, old_data, new_data FROM audit_logs
       WHERE affected_table = 'knowledge_documents' AND record_id = $1 ORDER BY id`,
      [documentId],
    );
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
    const users: Array<{ id: number }> = await dataSource.query(
      'SELECT id FROM users WHERE email = $1',
      [TEST_FIXTURE.wardenEmail],
    );
    wardenUserId = users[0].id;
  });

  afterEach(() => {
    embeddingProvider.reset();
  });

  afterAll(async () => {
    await queue.waitForIdle();
    await dataSource.query('DELETE FROM knowledge_documents WHERE name LIKE $1', [`${runPrefix}%`]);
    await dataSource
      .query('DELETE FROM knowledge_queries WHERE question LIKE $1', [`${runPrefix}%`])
      .catch(() => undefined); // imutável por trigger: o histórico de teste fica
    await app.close();
  });

  describe('PUT /api/v1/knowledge/documents/:id', () => {
    it('keeps the old chunks searchable while UPDATING, then swaps them atomically', async () => {
      const document = await uploadReady();
      const before = await filePaths(document.id);
      expect(await chunkContents(document.id)).toEqual([OLD_TEXT]);

      const release = embeddingProvider.hold();
      const res = await put(document.id, {
        file: { buffer: txt(NEW_TEXT), fileName: 'nova.txt' },
      });

      expect(res.status).toBe(202);
      expect((res.body as DocumentBody).status).toBe('UPDATING');
      // Com a nova versão ainda sendo processada, só existem os trechos antigos.
      expect(await chunkContents(document.id)).toEqual([OLD_TEXT]);
      expect((await filePaths(document.id)).pending_file_path).not.toBeNull();

      release();
      await queue.waitForIdle();

      const updated = await findDocument(document.id);
      expect(updated).toMatchObject({
        status: 'READY',
        failureReason: null,
        originalFileName: 'nova.txt',
      });
      expect(await chunkContents(document.id)).toEqual([NEW_TEXT]);

      const after = await filePaths(document.id);
      expect(after.pending_file_path).toBeNull();
      expect(after.file_path).not.toBe(before.file_path);
      expect(fileExists(after.file_path)).toBe(true);
      expect(fileExists(before.file_path)).toBe(false);
    });

    it('goes back to READY with the old version and failureReason when the update fails', async () => {
      const document = await uploadReady();
      const before = await filePaths(document.id);

      embeddingProvider.failWith('UNAVAILABLE');
      const res = await put(document.id, {
        file: { buffer: txt(NEW_TEXT), fileName: 'nova.txt' },
      });
      expect(res.status).toBe(202);
      const pendingPath = (
        await dataSource.query('SELECT pending_file_path FROM knowledge_documents WHERE id = $1', [
          document.id,
        ])
      )[0].pending_file_path as string | null;
      await queue.waitForIdle();

      const reverted = await findDocument(document.id);
      expect(reverted).toMatchObject({
        status: 'READY',
        failureReason: 'AI_UNAVAILABLE',
        originalFileName: 'original.txt',
      });
      expect(await chunkContents(document.id)).toEqual([OLD_TEXT]);

      const after = await filePaths(document.id);
      expect(after).toEqual({ file_path: before.file_path, pending_file_path: null });
      expect(fileExists(before.file_path)).toBe(true);
      // O arquivo da tentativa que falhou não fica órfão no disco.
      if (pendingPath) {
        expect(fileExists(pendingPath)).toBe(false);
      }
    });

    it('renames without reprocessing when only name is sent', async () => {
      const document = await uploadReady();
      embeddingProvider.reset();
      const newName = uniqueName();

      const res = await put(document.id, { name: newName });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ id: document.id, name: newName, status: 'READY' });
      expect(embeddingProvider.calls).toHaveLength(0);
      expect(await chunkContents(document.id)).toEqual([OLD_TEXT]);
    });

    it('answers 409 when the name belongs to another document', async () => {
      const first = await uploadReady();
      const second = await uploadReady();

      const res = await put(second.id, { name: first.name });

      expect(res.status).toBe(409);
      expect((await findDocument(second.id)).name).toBe(second.name);
    });

    it('answers 409 while the document is being processed', async () => {
      const release = embeddingProvider.hold();
      const created = await request(app.getHttpServer())
        .post('/api/v1/knowledge/documents')
        .set(authorized(wardenToken))
        .field('name', uniqueName())
        .attach('file', txt(OLD_TEXT), 'original.txt');
      const { id } = created.body as DocumentBody;

      const res = await put(id, { name: uniqueName() });
      release();
      await queue.waitForIdle();

      expect(res.status).toBe(409);
    });

    it('answers 400 when neither file nor name is sent', async () => {
      const document = await uploadReady();
      const res = await put(document.id, {});
      expect(res.status).toBe(400);
    });

    it('answers 404 for a document that does not exist', async () => {
      const res = await put(999999999, { name: uniqueName() });
      expect(res.status).toBe(404);
    });

    it('rejects PRISON_OFFICER with 403', async () => {
      const document = await uploadReady();
      const res = await put(document.id, { token: officerToken, name: uniqueName() });
      expect(res.status).toBe(403);
    });

    it('records UPDATE audit entries without the file content', async () => {
      const document = await uploadReady();
      await put(document.id, { name: uniqueName() });
      await put(document.id, { file: { buffer: txt(NEW_TEXT), fileName: 'nova.txt' } });
      await queue.waitForIdle();

      const entries = (await auditEntries(document.id)).filter((e) => e.action === 'UPDATE');
      expect(entries).toHaveLength(2);
      const serialized = JSON.stringify(entries);
      expect(serialized).not.toContain('diapasao');
      expect(serialized).not.toContain('bussola');
    });
  });

  describe('POST /api/v1/knowledge/documents/:id/reprocess', () => {
    it('reprocesses a FAILED document until READY', async () => {
      embeddingProvider.failWith('UNAVAILABLE');
      const created = await request(app.getHttpServer())
        .post('/api/v1/knowledge/documents')
        .set(authorized(wardenToken))
        .field('name', uniqueName())
        .attach('file', txt(OLD_TEXT), 'original.txt');
      const { id } = created.body as DocumentBody;
      await queue.waitForIdle();
      expect((await findDocument(id)).status).toBe('FAILED');
      embeddingProvider.reset();

      const res = await request(app.getHttpServer())
        .post(`/api/v1/knowledge/documents/${id}/reprocess`)
        .set(authorized(supervisorToken));
      expect(res.status).toBe(202);
      expect((res.body as DocumentBody).status).toBe('PROCESSING');
      await queue.waitForIdle();

      expect(await findDocument(id)).toMatchObject({ status: 'READY', failureReason: null });
      expect(await chunkContents(id)).toEqual([OLD_TEXT]);
    });

    it('reprocesses a NEEDS_REPROCESS document replacing the old-model chunks', async () => {
      const document = await uploadReady();
      await dataSource.query(
        `UPDATE knowledge_document_chunks SET embedding_model = 'outro:modelo' WHERE document_id = $1`,
        [document.id],
      );
      await dataSource.query(
        `UPDATE knowledge_documents SET status = 'NEEDS_REPROCESS' WHERE id = $1`,
        [document.id],
      );

      const res = await request(app.getHttpServer())
        .post(`/api/v1/knowledge/documents/${document.id}/reprocess`)
        .set(authorized(wardenToken));
      expect(res.status).toBe(202);
      await queue.waitForIdle();

      expect((await findDocument(document.id)).status).toBe('READY');
      const models: Array<{ embedding_model: string }> = await dataSource.query(
        'SELECT DISTINCT embedding_model FROM knowledge_document_chunks WHERE document_id = $1',
        [document.id],
      );
      expect(models).toEqual([{ embedding_model: embeddingProvider.modelId }]);
      expect(await chunkContents(document.id)).toEqual([OLD_TEXT]);
    });

    it('answers 409 for a READY document', async () => {
      const document = await uploadReady();
      const res = await request(app.getHttpServer())
        .post(`/api/v1/knowledge/documents/${document.id}/reprocess`)
        .set(authorized(wardenToken));
      expect(res.status).toBe(409);
    });

    it('answers 404 for a document that does not exist', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/knowledge/documents/999999999/reprocess')
        .set(authorized(wardenToken));
      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/v1/knowledge/documents/:id', () => {
    it('removes the row, chunks and file, keeps the query history and audits DELETE', async () => {
      const document = await uploadReady();
      const { file_path: filePath } = await filePaths(document.id);
      const question = `${runPrefix} pergunta antiga`;
      await dataSource.query(
        `INSERT INTO knowledge_queries (user_id, question, answer, outcome, sources)
         VALUES ($1, $2, 'resposta antiga', 'ANSWERED', $3)`,
        [
          wardenUserId,
          question,
          JSON.stringify([
            { documentId: document.id, documentName: document.name, position: 1, excerpt: 'x' },
          ]),
        ],
      );

      const res = await request(app.getHttpServer())
        .delete(`/api/v1/knowledge/documents/${document.id}`)
        .set(authorized(wardenToken));

      expect(res.status).toBe(204);
      const rows: unknown[] = await dataSource.query(
        'SELECT 1 FROM knowledge_documents WHERE id = $1',
        [document.id],
      );
      expect(rows).toHaveLength(0);
      expect(await chunkContents(document.id)).toEqual([]);
      expect(fileExists(filePath)).toBe(false);

      const history: Array<{ answer: string }> = await dataSource.query(
        'SELECT answer FROM knowledge_queries WHERE question = $1',
        [question],
      );
      expect(history).toEqual([{ answer: 'resposta antiga' }]);

      const deletes = (await auditEntries(document.id)).filter((e) => e.action === 'DELETE');
      expect(deletes).toHaveLength(1);
      expect(JSON.stringify(deletes[0])).not.toContain('bussola');
    });

    it('discards the result of a document deleted while it was being processed', async () => {
      const release = embeddingProvider.hold();
      const created = await request(app.getHttpServer())
        .post('/api/v1/knowledge/documents')
        .set(authorized(wardenToken))
        .field('name', uniqueName())
        .attach('file', txt(OLD_TEXT), 'original.txt');
      const { id } = created.body as DocumentBody;

      const res = await request(app.getHttpServer())
        .delete(`/api/v1/knowledge/documents/${id}`)
        .set(authorized(wardenToken));
      release();
      await queue.waitForIdle();

      expect(res.status).toBe(204);
      expect(await chunkContents(id)).toEqual([]);
    });

    it('answers 404 for a document that does not exist', async () => {
      const res = await request(app.getHttpServer())
        .delete('/api/v1/knowledge/documents/999999999')
        .set(authorized(wardenToken));
      expect(res.status).toBe(404);
    });

    it('rejects PRISON_OFFICER with 403', async () => {
      const document = await uploadReady();
      const res = await request(app.getHttpServer())
        .delete(`/api/v1/knowledge/documents/${document.id}`)
        .set(authorized(officerToken));
      expect(res.status).toBe(403);
    });
  });
});
