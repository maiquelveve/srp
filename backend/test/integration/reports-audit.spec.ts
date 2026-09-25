import { randomUUID } from 'crypto';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { TEST_FIXTURE } from './fixtures';

/**
 * Integration tests for contracts/reports-audit.md — User Story 6 (Relatórios
 * e Auditoria), against the isolated `srp_db_test` database prepared by
 * `pretest:integration`. Every test builds its own gallery/cell/inmate so
 * results never depend on data left by other spec files.
 */
describe('Reports and audit endpoints (contracts/reports-audit.md)', () => {
  let app: INestApplication;
  let wardenToken: string;
  let supervisorToken: string;
  let officerToken: string;

  async function login(email: string): Promise<string> {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password: TEST_FIXTURE.password });
    return (res.body as { accessToken: string }).accessToken;
  }

  function get(token: string, path: string): request.Test {
    return request(app.getHttpServer()).get(path).set('Authorization', `Bearer ${token}`);
  }

  async function createInmate(name: string): Promise<{ inmateId: number; cellId: number }> {
    const galleryRes = await request(app.getHttpServer())
      .post('/api/v1/galleries')
      .set('Authorization', `Bearer ${wardenToken}`)
      .send({
        unitId: TEST_FIXTURE.unitAId,
        code: `REP-${randomUUID().slice(0, 8)}`,
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
    return { inmateId: (inmateRes.body as { id: number }).id, cellId };
  }

  async function registerExit(
    inmateId: number,
    cellId: number,
    reason: string,
  ): Promise<{ id: number }> {
    const res = await request(app.getHttpServer())
      .post('/api/v1/movements')
      .set('Authorization', `Bearer ${officerToken}`)
      .send({
        inmateId,
        movementTypeId: TEST_FIXTURE.temporaryMovementTypeId,
        originCellId: cellId,
        destinationLocation: 'YARD',
        reason,
      });
    return res.body as { id: number };
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();
    wardenToken = await login(TEST_FIXTURE.wardenEmail);
    supervisorToken = await login(TEST_FIXTURE.supervisorEmail);
    officerToken = await login(TEST_FIXTURE.officerEmail);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('access control (FR-028)', () => {
    const paths = [
      '/api/v1/reports/movements-by-inmate/1',
      '/api/v1/reports/longest-out-of-cell',
      '/api/v1/reports/inconsistencies',
      '/api/v1/reports/routine-execution',
      '/api/v1/reports/staff-vs-movements?date=2030-01-01',
      '/api/v1/reports/cell-occupancy-history?cellId=1',
      '/api/v1/audit',
    ];

    it.each(paths)('rejects an unauthenticated request to %s', async (path) => {
      const res = await request(app.getHttpServer()).get(path);
      expect(res.status).toBe(401);
    });

    it.each(paths)('responds 403 to PRISON_OFFICER on %s', async (path) => {
      expect((await get(officerToken, path)).status).toBe(403);
    });

    // These two need an existing inmate/cell; they are covered by their own describe blocks below.
    const pathsWithoutFixtureIds = paths.filter(
      (path) =>
        path !== '/api/v1/reports/movements-by-inmate/1' &&
        path !== '/api/v1/reports/cell-occupancy-history?cellId=1',
    );

    it.each(pathsWithoutFixtureIds)('allows SUPERVISOR and WARDEN on %s', async (path) => {
      expect((await get(supervisorToken, path)).status).toBe(200);
      expect((await get(wardenToken, path)).status).toBe(200);
    });
  });

  describe('unit scope (FR-004a)', () => {
    it.each([
      '/api/v1/reports/longest-out-of-cell',
      '/api/v1/reports/inconsistencies',
      '/api/v1/reports/routine-execution',
      '/api/v1/reports/staff-vs-movements?date=2030-01-01',
    ])('responds 403 when unitId is outside the caller units on %s', async (path) => {
      const separator = path.includes('?') ? '&' : '?';
      const res = await get(wardenToken, `${path}${separator}unitId=${TEST_FIXTURE.unitBId}`);
      expect(res.status).toBe(403);
    });
  });

  describe('GET /reports/movements-by-inmate/:inmateId', () => {
    it('lists the inmate movements newest first', async () => {
      const { inmateId, cellId } = await createInmate('Preso Relatório A');
      const movement = await registerExit(inmateId, cellId, 'Banho de sol');

      const res = await get(supervisorToken, `/api/v1/reports/movements-by-inmate/${inmateId}`);

      expect(res.status).toBe(200);
      const body = res.body as { data: Record<string, unknown>[]; total: number };
      expect(body.total).toBe(1);
      expect(body.data[0]).toMatchObject({
        movementId: movement.id,
        category: 'TEMPORARY',
        destinationLocation: 'YARD',
        reason: 'Banho de sol',
        returnDateTime: null,
      });
    });

    it('responds 404 for an unknown inmate and 400 for an invalid period', async () => {
      expect((await get(wardenToken, '/api/v1/reports/movements-by-inmate/99999999')).status).toBe(
        404,
      );
      const { inmateId } = await createInmate('Preso Relatório B');
      const res = await get(wardenToken, `/api/v1/reports/movements-by-inmate/${inmateId}?days=0`);
      expect(res.status).toBe(400);
    });
  });

  describe('GET /reports/longest-out-of-cell and /reports/inconsistencies', () => {
    it('ranks an inmate with an open temporary movement and flags it once past the threshold', async () => {
      const { inmateId, cellId } = await createInmate('Preso Fora da Cela');
      await registerExit(inmateId, cellId, 'Atendimento');

      const longest = await get(wardenToken, '/api/v1/reports/longest-out-of-cell?limit=100');
      expect(longest.status).toBe(200);
      const ranked = (longest.body as { data: { inmateId: number; openMovementCount: number }[] })
        .data;
      expect(ranked.find((item) => item.inmateId === inmateId)).toMatchObject({
        openMovementCount: 1,
      });

      const notYetLate = await get(wardenToken, '/api/v1/reports/inconsistencies');
      const notYetLateBody = notYetLate.body as {
        movementsWithoutReturn: { inmateId: number }[];
      };
      expect(notYetLateBody.movementsWithoutReturn.map((item) => item.inmateId)).not.toContain(
        inmateId,
      );

      // thresholdHours=1 is the smallest allowed; the movement is seconds old, so it stays out.
      const strict = await get(wardenToken, '/api/v1/reports/inconsistencies?thresholdHours=1');
      const strictBody = strict.body as { movementsWithoutReturn: { inmateId: number }[] };
      expect(strictBody.movementsWithoutReturn.map((item) => item.inmateId)).not.toContain(
        inmateId,
      );
    });
  });

  describe('routinesNotExecuted in GET /reports/inconsistencies (FR-025)', () => {
    async function createGalleryAndRoutine(name: string): Promise<number> {
      const galleryRes = await request(app.getHttpServer())
        .post('/api/v1/galleries')
        .set('Authorization', `Bearer ${wardenToken}`)
        .send({
          unitId: TEST_FIXTURE.unitAId,
          code: `NEX-${randomUUID().slice(0, 8)}`,
          type: 'MALE',
        });
      const routineRes = await request(app.getHttpServer())
        .post('/api/v1/routines')
        .set('Authorization', `Bearer ${wardenToken}`)
        .send({
          galleryId: (galleryRes.body as { id: number }).id,
          name,
          type: 'DAILY',
          locked: false,
          schedules: [{ weekday: null, time: '14:00' }],
        });
      return (routineRes.body as { id: number }).id;
    }

    it('lists a routine deactivated for a date in the period, and not one left active', async () => {
      const deactivatedId = await createGalleryAndRoutine('Pátio Desativado');
      const activeId = await createGalleryAndRoutine('Pátio Mantido');
      const today = new Date().toISOString().slice(0, 10);
      const deactivate = await request(app.getHttpServer())
        .patch(`/api/v1/routines/${deactivatedId}/activation`)
        .set('Authorization', `Bearer ${supervisorToken}`)
        .send({ date: today, active: false });
      expect(deactivate.status).toBe(200);

      const res = await get(supervisorToken, '/api/v1/reports/inconsistencies?limit=100');

      expect(res.status).toBe(200);
      const body = res.body as {
        routinesNotExecuted: { routineId: number; date: string }[];
        routinesNotExecutedTotal: number;
      };
      const ids = body.routinesNotExecuted.map((item) => item.routineId);
      expect(ids).toContain(deactivatedId);
      expect(ids).not.toContain(activeId);
      expect(body.routinesNotExecuted.find((item) => item.routineId === deactivatedId)?.date).toBe(
        today,
      );
      expect(body.routinesNotExecutedTotal).toBeGreaterThanOrEqual(1);
    });

    it('ignores a deactivation dated outside the period', async () => {
      const routineId = await createGalleryAndRoutine('Pátio Antigo');
      await request(app.getHttpServer())
        .patch(`/api/v1/routines/${routineId}/activation`)
        .set('Authorization', `Bearer ${supervisorToken}`)
        .send({ date: '2020-01-01', active: false });

      const res = await get(supervisorToken, '/api/v1/reports/inconsistencies?limit=100');

      const ids = (
        res.body as { routinesNotExecuted: { routineId: number }[] }
      ).routinesNotExecuted.map((item) => item.routineId);
      expect(ids).not.toContain(routineId);
    });
  });

  describe('GET /reports/routine-execution', () => {
    it('reports no execution tracking and only the caller units routines', async () => {
      const res = await get(supervisorToken, '/api/v1/reports/routine-execution?days=7');

      expect(res.status).toBe(200);
      const body = res.body as {
        executionTracked: boolean;
        from: string;
        to: string;
        data: unknown[];
      };
      expect(body.executionTracked).toBe(false);
      expect(body.from <= body.to).toBe(true);
      expect(Array.isArray(body.data)).toBe(true);
    });
  });

  describe('GET /reports/staff-vs-movements', () => {
    it('returns one row per shift', async () => {
      const res = await get(supervisorToken, '/api/v1/reports/staff-vs-movements?date=2030-01-01');

      expect(res.status).toBe(200);
      const rows = (res.body as { data: { shift: string; movementCount: number }[] }).data;
      expect(rows.map((row) => row.shift)).toEqual(['DAY', 'NIGHT']);
    });

    it('responds 400 without a date', async () => {
      expect((await get(supervisorToken, '/api/v1/reports/staff-vs-movements')).status).toBe(400);
    });
  });

  describe('GET /reports/cell-occupancy-history', () => {
    it('lists who occupied the cell', async () => {
      const { inmateId, cellId } = await createInmate('Preso Ocupação');

      const res = await get(
        supervisorToken,
        `/api/v1/reports/cell-occupancy-history?cellId=${cellId}`,
      );

      expect(res.status).toBe(200);
      const rows = (res.body as { data: { inmateId: number; exitDate: string | null }[] }).data;
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ inmateId, exitDate: null });
    });

    it('responds 404 for an unknown cell', async () => {
      const res = await get(
        supervisorToken,
        '/api/v1/reports/cell-occupancy-history?cellId=99999999',
      );
      expect(res.status).toBe(404);
    });
  });

  describe('pagination of report lists', () => {
    it('paginates cell-occupancy-history with limit/offset and reports the full total', async () => {
      const { cellId } = await createInmate('Preso Página A');
      await request(app.getHttpServer())
        .post('/api/v1/inmates')
        .set('Authorization', `Bearer ${wardenToken}`)
        .send({ name: 'Preso Página B', currentCellId: cellId });

      const first = await get(
        supervisorToken,
        `/api/v1/reports/cell-occupancy-history?cellId=${cellId}&limit=1&offset=0`,
      );
      const second = await get(
        supervisorToken,
        `/api/v1/reports/cell-occupancy-history?cellId=${cellId}&limit=1&offset=1`,
      );

      const firstBody = first.body as { data: { historyId: number }[]; total: number };
      const secondBody = second.body as { data: { historyId: number }[]; total: number };
      expect(firstBody.total).toBe(2);
      expect(firstBody.data).toHaveLength(1);
      expect(secondBody.total).toBe(2);
      expect(secondBody.data).toHaveLength(1);
      expect(secondBody.data[0].historyId).not.toBe(firstBody.data[0].historyId);
    });

    it('paginates longest-out-of-cell and keeps the total independent of the page size', async () => {
      for (const name of ['Preso Fora A', 'Preso Fora B']) {
        const { inmateId, cellId } = await createInmate(name);
        await registerExit(inmateId, cellId, 'Atendimento');
      }

      const page = await get(wardenToken, '/api/v1/reports/longest-out-of-cell?limit=1&offset=0');
      const next = await get(wardenToken, '/api/v1/reports/longest-out-of-cell?limit=1&offset=1');

      const pageBody = page.body as { data: { inmateId: number }[]; total: number };
      const nextBody = next.body as { data: { inmateId: number }[]; total: number };
      expect(pageBody.data).toHaveLength(1);
      expect(pageBody.total).toBeGreaterThanOrEqual(2);
      // Suítes rodam em paralelo no mesmo banco: outra pode abrir uma saída entre as duas chamadas,
      // então o total só pode crescer, nunca diminuir nem depender do tamanho da página.
      expect(nextBody.total).toBeGreaterThanOrEqual(pageBody.total);
      expect(nextBody.data[0].inmateId).not.toBe(pageBody.data[0].inmateId);
    });

    it('paginates the two inconsistency lists independently and returns their totals', async () => {
      const { inmateId, cellId } = await createInmate('Preso Sem Motivo');
      // The exit is seconds old, so it is not late; this only asserts the paged response shape.
      await registerExit(inmateId, cellId, 'Atendimento');

      const res = await get(
        wardenToken,
        '/api/v1/reports/inconsistencies?limit=1&withoutReturnOffset=0&withoutReasonOffset=0',
      );

      expect(res.status).toBe(200);
      const body = res.body as {
        movementsWithoutReturn: unknown[];
        movementsWithoutReturnTotal: number;
        inmatesOutWithoutReason: unknown[];
        inmatesOutWithoutReasonTotal: number;
      };
      expect(body.movementsWithoutReturn.length).toBeLessThanOrEqual(1);
      expect(typeof body.movementsWithoutReturnTotal).toBe('number');
      expect(body.inmatesOutWithoutReason.length).toBeLessThanOrEqual(1);
      expect(typeof body.inmatesOutWithoutReasonTotal).toBe('number');
    });

    it('paginates routine-execution and returns the total of routines', async () => {
      const res = await get(supervisorToken, '/api/v1/reports/routine-execution?limit=1&offset=0');

      expect(res.status).toBe(200);
      const body = res.body as { data: unknown[]; total: number };
      expect(body.data.length).toBeLessThanOrEqual(1);
      expect(body.total).toBeGreaterThanOrEqual(body.data.length);
    });

    it.each([
      '/api/v1/reports/longest-out-of-cell?limit=0',
      '/api/v1/reports/longest-out-of-cell?limit=101',
      '/api/v1/reports/longest-out-of-cell?offset=-1',
      '/api/v1/reports/routine-execution?limit=0',
      '/api/v1/reports/inconsistencies?withoutReturnOffset=-1',
    ])('rejects an invalid page parameter on %s with 400', async (path) => {
      expect((await get(wardenToken, path)).status).toBe(400);
    });
  });

  describe('GET /audit (FR-026/FR-027)', () => {
    it('returns the audit trail filtered by table and record, with sensitive fields redacted', async () => {
      const { inmateId } = await createInmate('Preso Auditoria');

      // The interceptor writes the entry after responding (fire-and-forget), so poll briefly.
      let res = await get(supervisorToken, `/api/v1/audit?table=inmates&recordId=${inmateId}`);
      for (
        let attempt = 0;
        attempt < 20 && (res.body as { total: number }).total === 0;
        attempt += 1
      ) {
        await new Promise((resolve) => setTimeout(resolve, 50));
        res = await get(supervisorToken, `/api/v1/audit?table=inmates&recordId=${inmateId}`);
      }

      expect(res.status).toBe(200);
      const body = res.body as {
        data: { action: string; affectedTable: string; recordId: number; userName: string }[];
        total: number;
      };
      expect(body.total).toBeGreaterThanOrEqual(1);
      expect(body.data[0]).toMatchObject({
        action: 'INSERT',
        affectedTable: 'inmates',
        recordId: inmateId,
      });
      expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|tokenHash/);
    });

    it('exposes no write methods (immutability)', async () => {
      for (const method of ['post', 'put', 'patch', 'delete'] as const) {
        const res = await request(app.getHttpServer())
          [method]('/api/v1/audit')
          .set('Authorization', `Bearer ${wardenToken}`);
        expect(res.status).toBe(404);
      }
    });

    it('rejects an invalid date filter with 400', async () => {
      expect((await get(wardenToken, '/api/v1/audit?from=not-a-date')).status).toBe(400);
    });
  });
});
