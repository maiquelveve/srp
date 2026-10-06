import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { TEST_FIXTURE } from './fixtures';

const PDF_BUFFER = Buffer.from('%PDF-1.4\n%conteudo falso de teste\n%%EOF', 'latin1');
const DOCX_BUFFER = Buffer.concat([
  Buffer.from([0x50, 0x4b, 0x03, 0x04]),
  // `word/document.xml` é exigido por file-signature.ts para distinguir de outro OOXML (XLSX/PPTX).
  Buffer.from('...[Content_Types].xml...word/document.xml...resto das entradas do zip...', 'ascii'),
]);
const DOC_BUFFER = Buffer.concat([
  Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]),
  Buffer.from('resto de um .doc legado ', 'latin1'),
  // Stream "WordDocument" (UTF-16LE) é exigido por file-signature.ts para distinguir de outro CFB (XLS/PPT/MSI/MSG).
  Buffer.from('WordDocument', 'utf16le'),
]);
const TXT_BUFFER = Buffer.from('Instruções de preenchimento do formulário de teste.', 'utf8');
/** MZ (Windows PE) — mesmo conteúdo binário de um executável, extensão trocada pra .pdf (FR-013a). */
const EXE_DISGUISED_AS_PDF = Buffer.concat([
  Buffer.from([0x4d, 0x5a]),
  Buffer.from([0x90, 0x00, 0x03, 0x00, 0x00, 0x00, 0x04, 0x00]),
]);
/** > 1 MB — acima do `DOCUMENTS_MAX_FILE_SIZE_MB=1` de teste (env-setup.ts). */
const OVERSIZED_PDF_BUFFER = Buffer.concat([PDF_BUFFER, Buffer.alloc(1.5 * 1024 * 1024)]);

/**
 * contracts/documents.md (feature 002) — biblioteca de Formulários/Modelos
 * de Documentos/Manuais: enviar/listar/baixar (WARDEN+SUPERVISOR escrevem,
 * qualquer autenticado lê) e remover.
 */
describe('Documents endpoints (contracts/documents.md)', () => {
  let app: INestApplication;
  let wardenToken: string;
  let supervisorToken: string;
  let officerToken: string;
  let formTypeId: number;
  let templateTypeId: number;
  let manualTypeId: number;
  let nameCounter = 0;

  async function login(email: string, password: string) {
    return request(app.getHttpServer()).post('/api/v1/auth/login').send({ email, password });
  }

  function authed(method: 'get' | 'post' | 'delete', url: string, token: string) {
    return request(app.getHttpServer())[method](url).set('Authorization', `Bearer ${token}`);
  }

  function uploadDocument(
    token: string,
    options: { name?: string; documentTypeId: number; fileName: string; buffer: Buffer },
  ) {
    nameCounter += 1;
    return authed('post', '/api/v1/documents', token)
      .field('name', options.name ?? `Documento de teste ${Date.now()}-${nameCounter}`)
      .field('documentTypeId', String(options.documentTypeId))
      .attach('file', options.buffer, options.fileName);
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();

    const [wardenRes, supervisorRes, officerRes] = await Promise.all([
      login(TEST_FIXTURE.wardenEmail, TEST_FIXTURE.password),
      login(TEST_FIXTURE.supervisorEmail, TEST_FIXTURE.password),
      login(TEST_FIXTURE.officerEmail, TEST_FIXTURE.password),
    ]);
    wardenToken = (wardenRes.body as { accessToken: string }).accessToken;
    supervisorToken = (supervisorRes.body as { accessToken: string }).accessToken;
    officerToken = (officerRes.body as { accessToken: string }).accessToken;

    const types = await authed('get', '/api/v1/document-types', wardenToken);
    const typeList = types.body as { id: number; code: string; label: string }[];
    formTypeId = typeList.find((t) => t.code === 'FORM')!.id;
    templateTypeId = typeList.find((t) => t.code === 'TEMPLATE')!.id;
    manualTypeId = typeList.find((t) => t.code === 'MANUAL')!.id;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /api/v1/document-types', () => {
    it('rejects an unauthenticated request', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/document-types');
      expect(res.status).toBe(401);
    });

    it('lists the 3 fixed categories (FORM/TEMPLATE/MANUAL)', async () => {
      const res = await authed('get', '/api/v1/document-types', officerToken);
      expect(res.status).toBe(200);
      const codes = (res.body as { code: string }[]).map((t) => t.code).sort();
      expect(codes).toEqual(['FORM', 'MANUAL', 'TEMPLATE']);
    });
  });

  describe('POST /api/v1/documents', () => {
    it('lets WARDEN send a document in each category', async () => {
      for (const documentTypeId of [formTypeId, templateTypeId, manualTypeId]) {
        const res = await uploadDocument(wardenToken, {
          documentTypeId,
          fileName: 'formulario.pdf',
          buffer: PDF_BUFFER,
        });
        expect(res.status).toBe(201);
        expect(res.body).toMatchObject({ documentTypeId });
      }
    });

    it('lets SUPERVISOR send a document', async () => {
      const res = await uploadDocument(supervisorToken, {
        documentTypeId: formTypeId,
        fileName: 'modelo.docx',
        buffer: DOCX_BUFFER,
      });
      expect(res.status).toBe(201);
    });

    it('accepts DOC and TXT too', async () => {
      const doc = await uploadDocument(wardenToken, {
        documentTypeId: manualTypeId,
        fileName: 'manual-antigo.doc',
        buffer: DOC_BUFFER,
      });
      expect(doc.status).toBe(201);

      const txt = await uploadDocument(wardenToken, {
        documentTypeId: manualTypeId,
        fileName: 'leiame.txt',
        buffer: TXT_BUFFER,
      });
      expect(txt.status).toBe(201);
    });

    it('rejects PRISON_OFFICER sending a document (403)', async () => {
      const res = await uploadDocument(officerToken, {
        documentTypeId: formTypeId,
        fileName: 'formulario.pdf',
        buffer: PDF_BUFFER,
      });
      expect(res.status).toBe(403);
    });

    it('rejects an executable renamed to .pdf (400, assinatura não corresponde à extensão)', async () => {
      const res = await uploadDocument(wardenToken, {
        documentTypeId: formTypeId,
        fileName: 'relatorio.pdf',
        buffer: EXE_DISGUISED_AS_PDF,
      });
      expect(res.status).toBe(400);
    });

    it('rejects a duplicate name in the same category (409), but allows it in a different one', async () => {
      const name = `Portaria Duplicada ${Date.now()}`;
      const first = await uploadDocument(wardenToken, {
        name,
        documentTypeId: formTypeId,
        fileName: 'portaria.pdf',
        buffer: PDF_BUFFER,
      });
      expect(first.status).toBe(201);

      const duplicate = await uploadDocument(wardenToken, {
        name,
        documentTypeId: formTypeId,
        fileName: 'portaria.pdf',
        buffer: PDF_BUFFER,
      });
      expect(duplicate.status).toBe(409);

      const otherCategory = await uploadDocument(wardenToken, {
        name,
        documentTypeId: manualTypeId,
        fileName: 'portaria.pdf',
        buffer: PDF_BUFFER,
      });
      expect(otherCategory.status).toBe(201);
    });

    it('rejects a file over the configured maximum size (413)', async () => {
      const res = await uploadDocument(wardenToken, {
        documentTypeId: formTypeId,
        fileName: 'arquivo-grande.pdf',
        buffer: OVERSIZED_PDF_BUFFER,
      });
      expect(res.status).toBe(413);
    });
  });

  describe('GET /api/v1/documents', () => {
    it('lists only the documents of the requested category, newest first, paginated ({ data, total })', async () => {
      const older = await uploadDocument(wardenToken, {
        documentTypeId: templateTypeId,
        fileName: 'modelo-antigo.pdf',
        buffer: PDF_BUFFER,
      });
      const newer = await uploadDocument(wardenToken, {
        documentTypeId: templateTypeId,
        fileName: 'modelo-novo.pdf',
        buffer: PDF_BUFFER,
      });

      const res = await authed(
        'get',
        `/api/v1/documents?documentTypeId=${templateTypeId}`,
        officerToken,
      );
      expect(res.status).toBe(200);
      const body = res.body as { data: { id: number }[]; total: number };
      const ids = body.data.map((d) => d.id);
      expect(ids.indexOf((newer.body as { id: number }).id)).toBeLessThan(
        ids.indexOf((older.body as { id: number }).id),
      );
      expect(body.total).toBeGreaterThanOrEqual(2);

      const manualList = await authed(
        'get',
        `/api/v1/documents?documentTypeId=${manualTypeId}`,
        officerToken,
      );
      const manualIds = (manualList.body as { data: { id: number }[] }).data.map((d) => d.id);
      expect(manualIds).not.toContain((newer.body as { id: number }).id);
    });

    it('lists documents from every category when documentTypeId is omitted (Biblioteca de Documentos unificada)', async () => {
      const inForm = await uploadDocument(wardenToken, {
        documentTypeId: formTypeId,
        fileName: 'unificado-form.pdf',
        buffer: PDF_BUFFER,
      });
      const inManual = await uploadDocument(wardenToken, {
        documentTypeId: manualTypeId,
        fileName: 'unificado-manual.pdf',
        buffer: PDF_BUFFER,
      });

      const res = await authed('get', '/api/v1/documents?limit=100', officerToken);
      expect(res.status).toBe(200);
      const ids = (res.body as { data: { id: number }[] }).data.map((d) => d.id);
      expect(ids).toContain((inForm.body as { id: number }).id);
      expect(ids).toContain((inManual.body as { id: number }).id);
    });

    it('filters by a case-insensitive substring of the name (search)', async () => {
      const marker = `Busca${Date.now()}`;
      const matching = await uploadDocument(wardenToken, {
        name: `Relatório ${marker} de Teste`,
        documentTypeId: formTypeId,
        fileName: 'busca.pdf',
        buffer: PDF_BUFFER,
      });
      await uploadDocument(wardenToken, {
        documentTypeId: formTypeId,
        fileName: 'nao-deve-aparecer.pdf',
        buffer: PDF_BUFFER,
      });

      const res = await authed(
        'get',
        `/api/v1/documents?search=${marker.toLowerCase()}`,
        officerToken,
      );
      expect(res.status).toBe(200);
      const body = res.body as { data: { id: number }[]; total: number };
      expect(body.total).toBe(1);
      expect(body.data[0].id).toBe((matching.body as { id: number }).id);
    });

    it('paginates with limit/offset', async () => {
      for (let i = 0; i < 3; i += 1) {
        await uploadDocument(wardenToken, {
          documentTypeId: manualTypeId,
          fileName: `pagina-${Date.now()}-${i}.pdf`,
          buffer: PDF_BUFFER,
        });
      }

      const firstPage = await authed(
        'get',
        `/api/v1/documents?documentTypeId=${manualTypeId}&limit=1&offset=0`,
        officerToken,
      );
      const secondPage = await authed(
        'get',
        `/api/v1/documents?documentTypeId=${manualTypeId}&limit=1&offset=1`,
        officerToken,
      );
      const firstBody = firstPage.body as { data: { id: number }[]; total: number };
      const secondBody = secondPage.body as { data: { id: number }[]; total: number };
      expect(firstBody.data).toHaveLength(1);
      expect(secondBody.data).toHaveLength(1);
      expect(firstBody.data[0].id).not.toBe(secondBody.data[0].id);
      expect(firstBody.total).toBe(secondBody.total);
    });
  });

  describe('GET /api/v1/documents/:id/download', () => {
    it('downloads the exact bytes sent, named after the original file', async () => {
      const uploaded = await uploadDocument(wardenToken, {
        documentTypeId: formTypeId,
        fileName: 'baixar-teste.pdf',
        buffer: PDF_BUFFER,
      });
      expect(uploaded.status).toBe(201);
      const id = (uploaded.body as { id: number }).id;

      const res = await authed('get', `/api/v1/documents/${id}/download`, officerToken).buffer(
        true,
      );
      expect(res.status).toBe(200);
      expect(Buffer.compare(res.body as Buffer, PDF_BUFFER)).toBe(0);
      expect(res.headers['content-disposition']).toContain('baixar-teste.pdf');
    });

    it('rejects a download without authentication (401)', async () => {
      const uploaded = await uploadDocument(wardenToken, {
        documentTypeId: formTypeId,
        fileName: 'sem-auth.pdf',
        buffer: PDF_BUFFER,
      });
      const id = (uploaded.body as { id: number }).id;

      const res = await request(app.getHttpServer()).get(`/api/v1/documents/${id}/download`);
      expect(res.status).toBe(401);
    });

    it('responds 404 for an unknown document', async () => {
      const res = await authed('get', '/api/v1/documents/999999/download', wardenToken);
      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/v1/documents/:id', () => {
    it('rejects PRISON_OFFICER removing a document (403)', async () => {
      const uploaded = await uploadDocument(wardenToken, {
        documentTypeId: formTypeId,
        fileName: 'nao-remover.pdf',
        buffer: PDF_BUFFER,
      });
      const id = (uploaded.body as { id: number }).id;

      const res = await authed('delete', `/api/v1/documents/${id}`, officerToken);
      expect(res.status).toBe(403);
    });

    it('lets WARDEN/SUPERVISOR remove a document, which then 404s on download', async () => {
      const uploaded = await uploadDocument(supervisorToken, {
        documentTypeId: formTypeId,
        fileName: 'remover.pdf',
        buffer: PDF_BUFFER,
      });
      const id = (uploaded.body as { id: number }).id;

      const removed = await authed('delete', `/api/v1/documents/${id}`, supervisorToken);
      expect(removed.status).toBe(200);

      const afterRemoval = await authed('get', `/api/v1/documents/${id}/download`, wardenToken);
      expect(afterRemoval.status).toBe(404);
    });
  });
});
