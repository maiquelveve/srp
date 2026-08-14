import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { TEST_FIXTURE } from './fixtures';

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
  });
});
