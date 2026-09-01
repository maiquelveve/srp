import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { TEST_FIXTURE } from './fixtures';

/**
 * Integration tests for contracts/movements.md — User Story 3 (Situações
 * Definitivas), against the isolated `srp_db_test` database prepared by
 * `pretest:integration`. Also covers `GET /inmates/:id/location-history`
 * (FR-016), part of the same contract.
 */
describe('Movements endpoints — final/situações definitivas (contracts/movements.md)', () => {
  let app: INestApplication;
  let wardenToken: string;
  let officerToken: string;

  async function createInmate(
    name: string,
  ): Promise<{ inmateId: number; cellId: number; galleryId: number }> {
    const galleryRes = await request(app.getHttpServer())
      .post('/api/v1/galleries')
      .set('Authorization', `Bearer ${wardenToken}`)
      .send({
        unitId: TEST_FIXTURE.unitAId,
        code: `FIN-${Date.now()}-${Math.random()}`,
        type: 'MALE',
      });
    const galleryId = (galleryRes.body as { id: number }).id;

    const cellRes = await request(app.getHttpServer())
      .post('/api/v1/cells')
      .set('Authorization', `Bearer ${wardenToken}`)
      .send({ galleryId, code: '01', capacity: 4, type: 'SHARED' });
    const cellId = (cellRes.body as { id: number }).id;

    const inmateRes = await request(app.getHttpServer())
      .post('/api/v1/inmates')
      .set('Authorization', `Bearer ${wardenToken}`)
      .send({ name, currentCellId: cellId });

    return { inmateId: (inmateRes.body as { id: number }).id, cellId, galleryId };
  }

  async function cellOccupancy(cellId: number, galleryId: number): Promise<number> {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/galleries/${galleryId}/cells`)
      .set('Authorization', `Bearer ${wardenToken}`);
    const cells = (res.body as { data: { id: number; occupancy: number }[] }).data;
    return cells.find((c) => c.id === cellId)?.occupancy ?? -1;
  }

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

  describe('RBAC — WARDEN only (contracts/movements.md)', () => {
    it('rejects PRISON_OFFICER on every final/* endpoint (403)', async () => {
      const { inmateId } = await createInmate('Preso RBAC');

      const endpoints = [
        { path: 'release', body: { inmateId, reason: 'Alvará 1' } },
        { path: 'ankle-monitor', body: { inmateId, reason: 'Dispositivo 1' } },
        { path: 'transfer', body: { inmateId, reason: 'Escolta PM, Penitenciária Vizinha' } },
      ];
      for (const endpoint of endpoints) {
        const res = await request(app.getHttpServer())
          .post(`/api/v1/movements/final/${endpoint.path}`)
          .set('Authorization', `Bearer ${officerToken}`)
          .send(endpoint.body);
        expect(res.status).toBe(403);
      }
    });
  });

  it('registers liberdade (FR-012): status RELEASED, cela de origem liberada', async () => {
    const { inmateId, cellId, galleryId } = await createInmate('Preso Liberdade');
    expect(await cellOccupancy(cellId, galleryId)).toBe(1);

    const res = await request(app.getHttpServer())
      .post('/api/v1/movements/final/release')
      .set('Authorization', `Bearer ${wardenToken}`)
      .send({ inmateId, reason: 'Alvará nº 123, Vara Criminal, Agente João' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ inmateId, destinationLocation: 'Liberdade' });

    const inmateAfter = await request(app.getHttpServer())
      .get(`/api/v1/inmates/${inmateId}`)
      .set('Authorization', `Bearer ${wardenToken}`);
    expect(inmateAfter.body).toMatchObject({ status: 'RELEASED' });

    expect(await cellOccupancy(cellId, galleryId)).toBe(0);
  });

  it('registers tornozeleira (FR-013): status ANKLE_MONITOR', async () => {
    const { inmateId, cellId, galleryId } = await createInmate('Preso Tornozeleira');

    const res = await request(app.getHttpServer())
      .post('/api/v1/movements/final/ankle-monitor')
      .set('Authorization', `Bearer ${wardenToken}`)
      .send({
        inmateId,
        reason: 'Dispositivo nº 456, Empresa X',
        notes: 'Não pode sair do município',
      });
    expect(res.status).toBe(201);

    const inmateAfter = await request(app.getHttpServer())
      .get(`/api/v1/inmates/${inmateId}`)
      .set('Authorization', `Bearer ${wardenToken}`);
    expect(inmateAfter.body).toMatchObject({ status: 'ANKLE_MONITOR' });
    expect(await cellOccupancy(cellId, galleryId)).toBe(0);
  });

  it('registers transferência (FR-014): status TRANSFERRED', async () => {
    const { inmateId, cellId, galleryId } = await createInmate('Preso Transferência');

    const res = await request(app.getHttpServer())
      .post('/api/v1/movements/final/transfer')
      .set('Authorization', `Bearer ${wardenToken}`)
      .send({ inmateId, reason: 'Escolta PM, Penitenciária Vizinha' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ destinationLocation: 'Transferência' });

    const inmateAfter = await request(app.getHttpServer())
      .get(`/api/v1/inmates/${inmateId}`)
      .set('Authorization', `Bearer ${wardenToken}`);
    expect(inmateAfter.body).toMatchObject({ status: 'TRANSFERRED' });
    expect(await cellOccupancy(cellId, galleryId)).toBe(0);
  });

  describe('Bloqueio com movimentação temporária em aberto', () => {
    it('rejects final/release when the inmate has an open TEMPORARY movement (409)', async () => {
      const { inmateId, cellId } = await createInmate('Preso Em Atendimento');

      await request(app.getHttpServer())
        .post('/api/v1/movements')
        .set('Authorization', `Bearer ${wardenToken}`)
        .send({
          inmateId,
          movementTypeId: TEST_FIXTURE.temporaryMovementTypeId,
          originCellId: cellId,
          destinationLocation: 'Atendimento médico',
          reason: 'Consulta',
        });

      const res = await request(app.getHttpServer())
        .post('/api/v1/movements/final/release')
        .set('Authorization', `Bearer ${wardenToken}`)
        .send({ inmateId, reason: 'Tentativa' });
      expect(res.status).toBe(409);
    });
  });

  // Troca/permuta de cela/galeria (FR-015–FR-015c) têm sua própria suíte —
  // backend/test/integration/movements-cell-transfer.spec.ts (research.md #35).

  describe('GET /inmates/:id/location-history (FR-016)', () => {
    it('reconstructs the full cell timeline across a cell-change and a final situation', async () => {
      const { inmateId, cellId: originCellId, galleryId } = await createInmate('Preso Histórico');
      const destCellRes = await request(app.getHttpServer())
        .post('/api/v1/cells')
        .set('Authorization', `Bearer ${wardenToken}`)
        .send({ galleryId, code: '02', capacity: 2, type: 'SHARED' });
      const destinationCellId = (destCellRes.body as { id: number }).id;

      await request(app.getHttpServer())
        .post('/api/v1/movements/cell-change')
        .set('Authorization', `Bearer ${wardenToken}`)
        .send({ inmateId, destinationCellId, reason: 'Reorganização' });

      await request(app.getHttpServer())
        .post('/api/v1/movements/final/release')
        .set('Authorization', `Bearer ${wardenToken}`)
        .send({ inmateId, reason: 'Alvará nº 999' });

      const historyRes = await request(app.getHttpServer())
        .get(`/api/v1/inmates/${inmateId}/location-history`)
        .set('Authorization', `Bearer ${wardenToken}`);
      expect(historyRes.status).toBe(200);

      const entries = historyRes.body as {
        cellId: number;
        exitDate: string | null;
        reason: string | null;
      }[];
      expect(entries).toHaveLength(2);
      expect(entries[0]).toMatchObject({ cellId: originCellId, reason: 'CELL_CHANGE' });
      expect(entries[0].exitDate).not.toBeNull();
      expect(entries[1]).toMatchObject({ cellId: destinationCellId, reason: 'RELEASE' });
      expect(entries[1].exitDate).not.toBeNull();
    });

    it('rejects an inmate outside the caller unit scope (403/404)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/inmates/999999/location-history')
        .set('Authorization', `Bearer ${wardenToken}`);
      expect([403, 404]).toContain(res.status);
    });
  });
});
