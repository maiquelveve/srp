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

  describe('audit of the movement record (FR-026, SC-002)', () => {
    async function movementAudit(movementId: number) {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/audit?table=movements&recordId=${movementId}`)
        .set('Authorization', `Bearer ${wardenToken}`);
      return (res.body as { data: { action: string; newData: Record<string, unknown> | null }[] })
        .data;
    }

    it('writes a movements INSERT entry, with the reason, for a liberdade', async () => {
      const { inmateId } = await createInmate('Preso Auditoria Liberdade');

      const res = await request(app.getHttpServer())
        .post('/api/v1/movements/final/release')
        .set('Authorization', `Bearer ${wardenToken}`)
        .send({ inmateId, reason: 'Alvará nº 555 para auditoria' });

      const entries = await movementAudit((res.body as { id: number }).id);
      expect(entries).toHaveLength(1);
      expect(entries[0]).toMatchObject({
        action: 'INSERT',
        newData: { inmateId, reason: 'Alvará nº 555 para auditoria' },
      });
    });

    it('writes one movements INSERT entry per inmate of a permuta', async () => {
      const first = await createInmate('Preso Auditoria Permuta A');
      const secondCellRes = await request(app.getHttpServer())
        .post('/api/v1/cells')
        .set('Authorization', `Bearer ${wardenToken}`)
        .send({ galleryId: first.galleryId, code: '05', capacity: 2, type: 'SHARED' });
      const secondCellId = (secondCellRes.body as { id: number }).id;
      const secondInmateRes = await request(app.getHttpServer())
        .post('/api/v1/inmates')
        .set('Authorization', `Bearer ${wardenToken}`)
        .send({ name: 'Preso Auditoria Permuta B', currentCellId: secondCellId });
      const secondInmateId = (secondInmateRes.body as { id: number }).id;

      const swap = await request(app.getHttpServer())
        .post('/api/v1/movements/cell-swap')
        .set('Authorization', `Bearer ${wardenToken}`)
        .send({
          inmateId: first.inmateId,
          destinationCellId: secondCellId,
          destinationInmateId: secondInmateId,
          reason: 'Permuta auditada',
        });

      expect(swap.status).toBe(201);
      const movements = swap.body as { id: number }[];
      expect(movements).toHaveLength(2);
      for (const movement of movements) {
        const entries = await movementAudit(movement.id);
        expect(entries).toHaveLength(1);
        expect(entries[0].action).toBe('INSERT');
      }
    });
  });

  describe('inmate that is not ACTIVE (US3, Constituição IV)', () => {
    it('rejects a second liberdade, a tornozeleira and a transferência for a released inmate (409)', async () => {
      const { inmateId } = await createInmate('Preso Já Liberado');
      const first = await request(app.getHttpServer())
        .post('/api/v1/movements/final/release')
        .set('Authorization', `Bearer ${wardenToken}`)
        .send({ inmateId, reason: 'Alvará 1' });
      expect(first.status).toBe(201);

      for (const path of ['release', 'ankle-monitor', 'transfer']) {
        const res = await request(app.getHttpServer())
          .post(`/api/v1/movements/final/${path}`)
          .set('Authorization', `Bearer ${wardenToken}`)
          .send({ inmateId, reason: 'Repetido' });
        expect(res.status).toBe(409);
      }
    });

    it('rejects a cell-change for a released inmate (409) and keeps him RELEASED', async () => {
      const { inmateId, galleryId } = await createInmate('Preso Liberado Sem Troca');
      const otherCell = await request(app.getHttpServer())
        .post('/api/v1/cells')
        .set('Authorization', `Bearer ${wardenToken}`)
        .send({ galleryId, code: '09', capacity: 2, type: 'SHARED' });
      await request(app.getHttpServer())
        .post('/api/v1/movements/final/release')
        .set('Authorization', `Bearer ${wardenToken}`)
        .send({ inmateId, reason: 'Alvará' });

      const res = await request(app.getHttpServer())
        .post('/api/v1/movements/cell-change')
        .set('Authorization', `Bearer ${wardenToken}`)
        .send({
          inmateId,
          destinationCellId: (otherCell.body as { id: number }).id,
          reason: 'Não deveria trocar',
        });

      expect(res.status).toBe(409);
      const after = await request(app.getHttpServer())
        .get(`/api/v1/inmates/${inmateId}`)
        .set('Authorization', `Bearer ${wardenToken}`);
      expect(after.body).toMatchObject({ status: 'RELEASED' });
    });
  });

  describe('POST /movements/final/reversal (FR-016a)', () => {
    async function createCell(galleryId: number, code: string, capacity: number): Promise<number> {
      const res = await request(app.getHttpServer())
        .post('/api/v1/cells')
        .set('Authorization', `Bearer ${wardenToken}`)
        .send({ galleryId, code, capacity, type: 'SHARED' });
      return (res.body as { id: number }).id;
    }

    function reverse(token: string, body: Record<string, unknown>) {
      return request(app.getHttpServer())
        .post('/api/v1/movements/final/reversal')
        .set('Authorization', `Bearer ${token}`)
        .send(body);
    }

    function release(inmateId: number) {
      return request(app.getHttpServer())
        .post('/api/v1/movements/final/release')
        .set('Authorization', `Bearer ${wardenToken}`)
        .send({ inmateId, reason: 'Alvará registrado por engano' });
    }

    it('brings a released inmate back to ACTIVE in the chosen cell, keeping the original record', async () => {
      const { inmateId, galleryId } = await createInmate('Preso Reversão');
      const newCellId = await createCell(galleryId, '02', 2);
      const releaseRes = await release(inmateId);
      expect(releaseRes.status).toBe(201);
      const releaseMovementId = (releaseRes.body as { id: number }).id;

      const res = await reverse(wardenToken, {
        inmateId,
        destinationCellId: newCellId,
        reason: 'Liberdade lançada por engano',
      });

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ inmateId, destinationLocation: 'Cela 02' });
      const inmateAfter = await request(app.getHttpServer())
        .get(`/api/v1/inmates/${inmateId}`)
        .set('Authorization', `Bearer ${wardenToken}`);
      expect(inmateAfter.body).toMatchObject({ status: 'ACTIVE' });
      expect(await cellOccupancy(newCellId, galleryId)).toBe(1);

      // O registro original continua no histórico; a reversão é uma movimentação nova.
      const movements = await request(app.getHttpServer())
        .get(`/api/v1/movements?inmateId=${inmateId}`)
        .set('Authorization', `Bearer ${wardenToken}`);
      const ids = (movements.body as { data: { id: number }[] }).data.map((item) => item.id);
      expect(ids).toContain(releaseMovementId);
      expect(ids).toContain((res.body as { id: number }).id);

      const history = await request(app.getHttpServer())
        .get(`/api/v1/inmates/${inmateId}/location-history`)
        .set('Authorization', `Bearer ${wardenToken}`);
      const entries = history.body as { cellId: number; exitDate: string | null }[];
      expect(entries).toHaveLength(2);
      expect(entries[0].exitDate).not.toBeNull();
      expect(entries[1]).toMatchObject({ cellId: newCellId, exitDate: null });
    });

    it('reverts an ankle monitor and a transfer too', async () => {
      const first = await createInmate('Preso Reversão Tornozeleira');
      const second = await createInmate('Preso Reversão Transferência');
      await request(app.getHttpServer())
        .post('/api/v1/movements/final/ankle-monitor')
        .set('Authorization', `Bearer ${wardenToken}`)
        .send({ inmateId: first.inmateId, reason: 'Dispositivo lançado por engano' });
      await request(app.getHttpServer())
        .post('/api/v1/movements/final/transfer')
        .set('Authorization', `Bearer ${wardenToken}`)
        .send({ inmateId: second.inmateId, reason: 'Transferência lançada por engano' });

      const firstRes = await reverse(wardenToken, {
        inmateId: first.inmateId,
        destinationCellId: first.cellId,
        reason: 'Erro de lançamento',
      });
      const secondRes = await reverse(wardenToken, {
        inmateId: second.inmateId,
        destinationCellId: second.cellId,
        reason: 'Erro de lançamento',
      });

      expect(firstRes.status).toBe(201);
      expect(secondRes.status).toBe(201);
    });

    it('rejects PRISON_OFFICER and SUPERVISOR (403)', async () => {
      const { inmateId, cellId } = await createInmate('Preso Reversão RBAC');
      await release(inmateId);
      const supervisorLogin = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: TEST_FIXTURE.supervisorEmail, password: TEST_FIXTURE.password });
      const supervisorToken = (supervisorLogin.body as { accessToken: string }).accessToken;
      const body = { inmateId, destinationCellId: cellId, reason: 'Erro' };

      expect((await reverse(officerToken, body)).status).toBe(403);
      expect((await reverse(supervisorToken, body)).status).toBe(403);
    });

    it('rejects an inmate that is still ACTIVE (409)', async () => {
      const { inmateId, cellId } = await createInmate('Preso Ativo Reversão');

      const res = await reverse(wardenToken, {
        inmateId,
        destinationCellId: cellId,
        reason: 'Erro',
      });

      expect(res.status).toBe(409);
    });

    it('requires a reason (400) and a destination cell with a vacancy (400)', async () => {
      const { inmateId, galleryId } = await createInmate('Preso Reversão Validação');
      const fullCellId = await createCell(galleryId, '03', 1);
      await request(app.getHttpServer())
        .post('/api/v1/inmates')
        .set('Authorization', `Bearer ${wardenToken}`)
        .send({ name: 'Ocupante da cela cheia', currentCellId: fullCellId });
      await release(inmateId);

      const noReason = await reverse(wardenToken, { inmateId, destinationCellId: fullCellId });
      const full = await reverse(wardenToken, {
        inmateId,
        destinationCellId: fullCellId,
        reason: 'Erro',
      });

      expect(noReason.status).toBe(400);
      expect(full.status).toBe(400);
    });
  });

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
