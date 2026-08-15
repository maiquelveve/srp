import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { TEST_FIXTURE } from './fixtures';

/** No external jwt-decode dep needed just to read `sub` out of a test token. */
function decodeJwtSub(token: string): number {
  const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString('utf8')) as {
    sub: number;
  };
  return payload.sub;
}

/**
 * Integration tests for contracts/structure.md — User Story 1
 * (Cadastro e Mapa da Unidade), against the isolated `srp_db_test` database
 * prepared by `pretest:integration` (research.md #1).
 */
describe('Structure endpoints (contracts/structure.md)', () => {
  let app: INestApplication;
  let wardenToken: string;
  let officerToken: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();

    const wardenLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: TEST_FIXTURE.wardenEmail, password: TEST_FIXTURE.password });
    wardenToken = (wardenLogin.body as { accessToken: string }).accessToken;

    const officerLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: TEST_FIXTURE.officerEmail, password: TEST_FIXTURE.password });
    officerToken = (officerLogin.body as { accessToken: string }).accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects an unauthenticated request', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/units');
    expect(res.status).toBe(401);
  });

  it('rejects PRISON_OFFICER creating a unit (FR-002/FR-004)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/units')
      .set('Authorization', `Bearer ${officerToken}`)
      .send({ name: 'Unidade Não Autorizada' });
    expect(res.status).toBe(403);
  });

  it('allows WARDEN to create a unit', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/units')
      .set('Authorization', `Bearer ${wardenToken}`)
      .send({ name: 'Unidade Criada No Teste', code: 'IT-01' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      name: 'Unidade Criada No Teste',
      code: 'IT-01',
      active: true,
    });
  });

  it('filters GET /units to only the caller unit scope (FR-004a)', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/units')
      .set('Authorization', `Bearer ${wardenToken}`);

    expect(res.status).toBe(200);
    const ids: number[] = (res.body as { data: { id: number }[] }).data.map((u) => u.id);
    expect(ids).toContain(TEST_FIXTURE.unitAId);
    expect(ids).not.toContain(TEST_FIXTURE.unitBId);
  });

  it('rejects creating a gallery in an out-of-scope unit (403)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/galleries')
      .set('Authorization', `Bearer ${wardenToken}`)
      .send({ unitId: TEST_FIXTURE.unitBId, code: 'X', type: 'MALE' });
    expect(res.status).toBe(403);
  });

  it('runs the full US1 flow: gallery -> cell -> inmate -> filtered lookup', async () => {
    const galleryRes = await request(app.getHttpServer())
      .post('/api/v1/galleries')
      .set('Authorization', `Bearer ${wardenToken}`)
      .send({ unitId: TEST_FIXTURE.unitAId, code: 'IT-GAL', type: 'MALE' });
    expect(galleryRes.status).toBe(201);
    const galleryId = (galleryRes.body as { id: number }).id;

    const cellRes = await request(app.getHttpServer())
      .post('/api/v1/cells')
      .set('Authorization', `Bearer ${wardenToken}`)
      .send({ galleryId, code: 'IT-01', capacity: 1, type: 'SHARED' });
    expect(cellRes.status).toBe(201);
    const cellId = (cellRes.body as { id: number }).id;

    const inmateRes = await request(app.getHttpServer())
      .post('/api/v1/inmates')
      .set('Authorization', `Bearer ${wardenToken}`)
      .send({ name: 'Preso Teste', currentCellId: cellId });
    expect(inmateRes.status).toBe(201);
    expect(inmateRes.body).toMatchObject({ status: 'ACTIVE', currentCellId: cellId });

    // Cell is now at capacity (1/1) — a second inmate must be rejected.
    const overflowRes = await request(app.getHttpServer())
      .post('/api/v1/inmates')
      .set('Authorization', `Bearer ${wardenToken}`)
      .send({ name: 'Preso Excedente', currentCellId: cellId });
    expect(overflowRes.status).toBe(400);

    const lookupRes = await request(app.getHttpServer())
      .get(`/api/v1/inmates?cellId=${cellId}`)
      .set('Authorization', `Bearer ${officerToken}`);
    expect(lookupRes.status).toBe(200);
    expect((lookupRes.body as { total: number }).total).toBe(1);

    const patchGalleryRes = await request(app.getHttpServer())
      .patch(`/api/v1/galleries/${galleryId}`)
      .set('Authorization', `Bearer ${wardenToken}`)
      .send({ type: 'FEMALE' });
    expect(patchGalleryRes.status).toBe(200);
    expect(patchGalleryRes.body).toMatchObject({ id: galleryId, type: 'FEMALE' });

    const patchCellRes = await request(app.getHttpServer())
      .patch(`/api/v1/cells/${cellId}`)
      .set('Authorization', `Bearer ${wardenToken}`)
      .send({ capacity: 2, type: 'INDIVIDUAL' });
    expect(patchCellRes.status).toBe(200);
    expect(patchCellRes.body).toMatchObject({ id: cellId, capacity: 2, type: 'INDIVIDUAL' });
  });

  it('rejects PRISON_OFFICER updating a gallery or cell (FR-002/FR-004)', async () => {
    const galleryRes = await request(app.getHttpServer())
      .post('/api/v1/galleries')
      .set('Authorization', `Bearer ${wardenToken}`)
      .send({ unitId: TEST_FIXTURE.unitAId, code: 'IT-GAL-PATCH', type: 'MALE' });
    const galleryId = (galleryRes.body as { id: number }).id;

    const cellRes = await request(app.getHttpServer())
      .post('/api/v1/cells')
      .set('Authorization', `Bearer ${wardenToken}`)
      .send({ galleryId, code: 'IT-01-PATCH', capacity: 1, type: 'SHARED' });
    const cellId = (cellRes.body as { id: number }).id;

    const galleryPatchRes = await request(app.getHttpServer())
      .patch(`/api/v1/galleries/${galleryId}`)
      .set('Authorization', `Bearer ${officerToken}`)
      .send({ type: 'FEMALE' });
    expect(galleryPatchRes.status).toBe(403);

    const cellPatchRes = await request(app.getHttpServer())
      .patch(`/api/v1/cells/${cellId}`)
      .set('Authorization', `Bearer ${officerToken}`)
      .send({ type: 'INDIVIDUAL' });
    expect(cellPatchRes.status).toBe(403);
  });

  describe('cascading deactivation', () => {
    async function createGallery(code: string): Promise<number> {
      const res = await request(app.getHttpServer())
        .post('/api/v1/galleries')
        .set('Authorization', `Bearer ${wardenToken}`)
        .send({ unitId: TEST_FIXTURE.unitAId, code, type: 'MALE' });
      return (res.body as { id: number }).id;
    }

    async function createCell(galleryId: number, code: string): Promise<number> {
      const res = await request(app.getHttpServer())
        .post('/api/v1/cells')
        .set('Authorization', `Bearer ${wardenToken}`)
        .send({ galleryId, code, capacity: 2, type: 'SHARED' });
      return (res.body as { id: number }).id;
    }

    async function createInmate(cellId: number, name: string): Promise<number> {
      const res = await request(app.getHttpServer())
        .post('/api/v1/inmates')
        .set('Authorization', `Bearer ${wardenToken}`)
        .send({ name, currentCellId: cellId });
      return (res.body as { id: number }).id;
    }

    // `POST /units` doesn't add the creating WARDEN to the new unit's scope
    // (research.md #21, a known gap) — a fresh unit is otherwise invisible
    // to `wardenToken` (issued in `beforeAll`, scoped only to unitA), so
    // `PATCH /units/:id` on it would 403 before ever reaching the cascade
    // logic under test. Grant access directly and re-login for a token that
    // actually carries the new unit in its `units` claim.
    async function tokenScopedToUnit(unitId: number): Promise<string> {
      const dataSource = app.get(DataSource);
      const wardenId = decodeJwtSub(wardenToken);
      await dataSource.query('INSERT INTO user_units (user_id, unit_id) VALUES ($1, $2)', [
        wardenId,
        unitId,
      ]);
      const relogin = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: TEST_FIXTURE.wardenEmail, password: TEST_FIXTURE.password });
      return (relogin.body as { accessToken: string }).accessToken;
    }

    it('rejects deactivating a cell that still holds an ACTIVE inmate', async () => {
      const galleryId = await createGallery('IT-CASC-1');
      const cellId = await createCell(galleryId, 'C1');
      await createInmate(cellId, 'Preso Cascata 1');

      const res = await request(app.getHttpServer())
        .patch(`/api/v1/cells/${cellId}`)
        .set('Authorization', `Bearer ${wardenToken}`)
        .send({ active: false });
      expect(res.status).toBe(409);

      const cellCheck = await request(app.getHttpServer())
        .get(`/api/v1/galleries/${galleryId}/cells`)
        .set('Authorization', `Bearer ${wardenToken}`);
      const cell = (cellCheck.body as { data: { id: number; active: boolean }[] }).data.find(
        (c) => c.id === cellId,
      );
      expect(cell?.active).toBe(true);
    });

    it('deactivates an empty cell directly', async () => {
      const galleryId = await createGallery('IT-CASC-2');
      const cellId = await createCell(galleryId, 'C1');

      const res = await request(app.getHttpServer())
        .patch(`/api/v1/cells/${cellId}`)
        .set('Authorization', `Bearer ${wardenToken}`)
        .send({ active: false });
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ id: cellId, active: false });
    });

    it('rejects deactivating a gallery with an ACTIVE inmate in any of its cells', async () => {
      const galleryId = await createGallery('IT-CASC-3');
      const cellId = await createCell(galleryId, 'C1');
      await createInmate(cellId, 'Preso Cascata 2');

      const res = await request(app.getHttpServer())
        .patch(`/api/v1/galleries/${galleryId}`)
        .set('Authorization', `Bearer ${wardenToken}`)
        .send({ active: false });
      expect(res.status).toBe(409);
    });

    it('cascades gallery deactivation to all its cells when none has an ACTIVE inmate', async () => {
      const galleryId = await createGallery('IT-CASC-4');
      const cellId1 = await createCell(galleryId, 'C1');
      const cellId2 = await createCell(galleryId, 'C2');

      const res = await request(app.getHttpServer())
        .patch(`/api/v1/galleries/${galleryId}`)
        .set('Authorization', `Bearer ${wardenToken}`)
        .send({ active: false });
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ id: galleryId, active: false });

      const cellsRes = await request(app.getHttpServer())
        .get(`/api/v1/galleries/${galleryId}/cells`)
        .set('Authorization', `Bearer ${wardenToken}`);
      const cells = (cellsRes.body as { data: { id: number; active: boolean }[] }).data;
      expect(cells.find((c) => c.id === cellId1)?.active).toBe(false);
      expect(cells.find((c) => c.id === cellId2)?.active).toBe(false);
    });

    it('rejects deactivating a unit with an ACTIVE inmate anywhere under it', async () => {
      const unitRes = await request(app.getHttpServer())
        .post('/api/v1/units')
        .set('Authorization', `Bearer ${wardenToken}`)
        .send({ name: 'Unidade Cascata Bloqueio' });
      const unitId = (unitRes.body as { id: number }).id;
      const scopedToken = await tokenScopedToUnit(unitId);

      const galleryRes = await request(app.getHttpServer())
        .post('/api/v1/galleries')
        .set('Authorization', `Bearer ${scopedToken}`)
        .send({ unitId, code: 'IT-CASC-5', type: 'MALE' });
      const galleryId = (galleryRes.body as { id: number }).id;

      const cellRes = await request(app.getHttpServer())
        .post('/api/v1/cells')
        .set('Authorization', `Bearer ${scopedToken}`)
        .send({ galleryId, code: 'C1', capacity: 2, type: 'SHARED' });
      const cellId = (cellRes.body as { id: number }).id;

      await request(app.getHttpServer())
        .post('/api/v1/inmates')
        .set('Authorization', `Bearer ${scopedToken}`)
        .send({ name: 'Preso Cascata 3', currentCellId: cellId });

      const res = await request(app.getHttpServer())
        .patch(`/api/v1/units/${unitId}`)
        .set('Authorization', `Bearer ${scopedToken}`)
        .send({ active: false });
      expect(res.status).toBe(409);
    });

    it('cascades unit deactivation to its galleries and their cells when no ACTIVE inmate is left', async () => {
      const unitRes = await request(app.getHttpServer())
        .post('/api/v1/units')
        .set('Authorization', `Bearer ${wardenToken}`)
        .send({ name: 'Unidade Cascata OK' });
      const unitId = (unitRes.body as { id: number }).id;
      const scopedToken = await tokenScopedToUnit(unitId);

      const galleryRes = await request(app.getHttpServer())
        .post('/api/v1/galleries')
        .set('Authorization', `Bearer ${scopedToken}`)
        .send({ unitId, code: 'IT-CASC-6', type: 'MALE' });
      const galleryId = (galleryRes.body as { id: number }).id;

      const cellRes = await request(app.getHttpServer())
        .post('/api/v1/cells')
        .set('Authorization', `Bearer ${scopedToken}`)
        .send({ galleryId, code: 'C1', capacity: 2, type: 'SHARED' });
      const cellId = (cellRes.body as { id: number }).id;

      const res = await request(app.getHttpServer())
        .patch(`/api/v1/units/${unitId}`)
        .set('Authorization', `Bearer ${scopedToken}`)
        .send({ active: false });
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ id: unitId, active: false });

      const galleriesRes = await request(app.getHttpServer())
        .get(`/api/v1/units/${unitId}/galleries`)
        .set('Authorization', `Bearer ${scopedToken}`);
      const gallery = (galleriesRes.body as { data: { id: number; active: boolean }[] }).data.find(
        (g) => g.id === galleryId,
      );
      expect(gallery?.active).toBe(false);

      const cellsRes = await request(app.getHttpServer())
        .get(`/api/v1/galleries/${galleryId}/cells`)
        .set('Authorization', `Bearer ${scopedToken}`);
      const cell = (cellsRes.body as { data: { id: number; active: boolean }[] }).data.find(
        (c) => c.id === cellId,
      );
      expect(cell?.active).toBe(false);
    });
  });
});
