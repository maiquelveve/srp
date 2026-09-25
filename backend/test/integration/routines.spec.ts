import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { TEST_FIXTURE } from './fixtures';

/**
 * Integration tests for contracts/routines.md — User Story 4 (Gestão de
 * Rotinas Operacionais), against the isolated `srp_db_test` database
 * prepared by `pretest:integration` (research.md #1).
 */
describe('Routines endpoints (contracts/routines.md)', () => {
  let app: INestApplication;
  let wardenToken: string;
  let supervisorToken: string;
  let officerToken: string;

  async function createGallery(): Promise<number> {
    const res = await request(app.getHttpServer())
      .post('/api/v1/galleries')
      .set('Authorization', `Bearer ${wardenToken}`)
      .send({
        unitId: TEST_FIXTURE.unitAId,
        code: `ROT-${Date.now()}-${Math.random()}`,
        type: 'MALE',
      });
    return (res.body as { id: number }).id;
  }

  async function createRoutine(
    galleryId: number,
    overrides: Partial<{
      name: string;
      type: string;
      locked: boolean;
      weekday: number | null;
      time: string;
      confirmOverlap: boolean;
    }> = {},
  ): Promise<number> {
    const res = await request(app.getHttpServer())
      .post('/api/v1/routines')
      .set('Authorization', `Bearer ${wardenToken}`)
      .send({
        galleryId,
        name: overrides.name ?? 'Pátio',
        type: overrides.type ?? 'DAILY',
        locked: overrides.locked ?? false,
        schedules: [{ weekday: overrides.weekday ?? null, time: overrides.time ?? '09:00' }],
        confirmOverlap: overrides.confirmOverlap,
      });
    return (res.body as { id: number }).id;
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

    const supervisorLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: TEST_FIXTURE.supervisorEmail, password: TEST_FIXTURE.password });
    supervisorToken = (supervisorLogin.body as { accessToken: string }).accessToken;

    const officerLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: TEST_FIXTURE.officerEmail, password: TEST_FIXTURE.password });
    officerToken = (officerLogin.body as { accessToken: string }).accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects an unauthenticated request', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/routines');
    expect(res.status).toBe(401);
  });

  it('rejects SUPERVISOR/PRISON_OFFICER creating a routine (FR-003/FR-019)', async () => {
    const galleryId = await createGallery();
    for (const token of [supervisorToken, officerToken]) {
      const res = await request(app.getHttpServer())
        .post('/api/v1/routines')
        .set('Authorization', `Bearer ${token}`)
        .send({ galleryId, name: 'Pátio', type: 'DAILY', schedules: [{ time: '09:00' }] });
      expect(res.status).toBe(403);
    }
  });

  it('allows WARDEN to create a routine with schedules (FR-017)', async () => {
    const galleryId = await createGallery();
    const res = await request(app.getHttpServer())
      .post('/api/v1/routines')
      .set('Authorization', `Bearer ${wardenToken}`)
      .send({
        galleryId,
        name: 'Pátio',
        type: 'DAILY',
        locked: true,
        schedules: [{ weekday: null, time: '09:00' }],
      });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      name: 'Pátio',
      type: 'DAILY',
      galleryId,
      locked: true,
      active: true,
    });
    expect((res.body as { schedules: unknown[] }).schedules).toHaveLength(1);
  });

  it('rejects a routine with more than 3 schedules (400)', async () => {
    const galleryId = await createGallery();
    const res = await request(app.getHttpServer())
      .post('/api/v1/routines')
      .set('Authorization', `Bearer ${wardenToken}`)
      .send({
        galleryId,
        name: 'Pátio',
        type: 'DAILY',
        schedules: [
          { weekday: 0, time: '08:00' },
          { weekday: 1, time: '09:00' },
          { weekday: 2, time: '10:00' },
          { weekday: 3, time: '11:00' },
        ],
      });
    expect(res.status).toBe(400);
  });

  it('rejects a routine with the same weekday+time repeated, on create and on schedule update (400)', async () => {
    const galleryId = await createGallery();

    const createRes = await request(app.getHttpServer())
      .post('/api/v1/routines')
      .set('Authorization', `Bearer ${wardenToken}`)
      .send({
        galleryId,
        name: 'Corre',
        type: 'WEEKDAY',
        schedules: [
          { weekday: 1, time: '09:00' },
          { weekday: 1, time: '09:00' },
        ],
      });
    expect(createRes.status).toBe(400);

    const routineId = await createRoutine(galleryId, { name: 'Faxina' });
    const scheduleRes = await request(app.getHttpServer())
      .patch(`/api/v1/routines/${routineId}/schedule`)
      .set('Authorization', `Bearer ${wardenToken}`)
      .send({
        schedules: [
          { weekday: 3, time: '09:00' },
          { weekday: 3, time: '09:00' },
        ],
      });
    expect(scheduleRes.status).toBe(400);
  });

  it('rejects "todos os dias" combined with a specific weekday at the same time (400)', async () => {
    const galleryId = await createGallery();
    const res = await request(app.getHttpServer())
      .post('/api/v1/routines')
      .set('Authorization', `Bearer ${wardenToken}`)
      .send({
        galleryId,
        name: 'Corre',
        type: 'WEEKDAY',
        schedules: [
          { weekday: null, time: '09:00' },
          { weekday: 2, time: '09:00' },
        ],
      });
    expect(res.status).toBe(400);
  });

  it('allows the same time on different specific weekdays (not a repeat)', async () => {
    const galleryId = await createGallery();
    const res = await request(app.getHttpServer())
      .post('/api/v1/routines')
      .set('Authorization', `Bearer ${wardenToken}`)
      .send({
        galleryId,
        name: 'Missa',
        type: 'WEEKDAY',
        schedules: [
          { weekday: 0, time: '15:00' },
          { weekday: 3, time: '15:00' },
          { weekday: 6, time: '15:00' },
        ],
      });
    expect(res.status).toBe(201);
    expect((res.body as { schedules: unknown[] }).schedules).toHaveLength(3);
  });

  it('lists a routine scheduled for every day, filtered by gallery (FR-020)', async () => {
    const galleryId = await createGallery();
    const routineId = await createRoutine(galleryId, { name: 'Corre' });

    const res = await request(app.getHttpServer())
      .get('/api/v1/routines')
      .query({ galleryId, shift: 'today' })
      .set('Authorization', `Bearer ${wardenToken}`);

    expect(res.status).toBe(200);
    const ids = (res.body as { data: { id: number }[] }).data.map((r) => r.id);
    expect(ids).toContain(routineId);
  });

  it('excludes a routine from the list on a date it has no schedule for', async () => {
    const galleryId = await createGallery();
    // Weekday-only routine (e.g. every Monday=1); querying a Sunday (2026-08-09
    // is a Sunday, weekday 0) must not return it.
    const routineId = await createRoutine(galleryId, { name: 'Visita', weekday: 1 });

    const res = await request(app.getHttpServer())
      .get('/api/v1/routines')
      .query({ galleryId, date: '2026-08-09' })
      .set('Authorization', `Bearer ${wardenToken}`);

    expect(res.status).toBe(200);
    const ids = (res.body as { data: { id: number }[] }).data.map((r) => r.id);
    expect(ids).not.toContain(routineId);
  });

  it('allows SUPERVISOR to adjust schedule/activation of a non-locked routine (FR-019)', async () => {
    const galleryId = await createGallery();
    const routineId = await createRoutine(galleryId, { name: 'Faxina', locked: false });

    const scheduleRes = await request(app.getHttpServer())
      .patch(`/api/v1/routines/${routineId}/schedule`)
      .set('Authorization', `Bearer ${supervisorToken}`)
      .send({ schedules: [{ weekday: null, time: '14:00' }] });
    expect(scheduleRes.status).toBe(200);
    expect((scheduleRes.body as { schedules: { time: string }[] }).schedules[0].time).toBe('14:00');

    const activationRes = await request(app.getHttpServer())
      .patch(`/api/v1/routines/${routineId}/activation`)
      .set('Authorization', `Bearer ${supervisorToken}`)
      .send({ date: '2026-08-09', active: false });
    expect(activationRes.status).toBe(200);
    expect(activationRes.body).toEqual({ routineId, date: '2026-08-09', active: false });

    const deactivatedDay = await request(app.getHttpServer())
      .get('/api/v1/routines')
      .query({ galleryId, date: '2026-08-09' })
      .set('Authorization', `Bearer ${wardenToken}`);
    expect((deactivatedDay.body as { data: { id: number }[] }).data.map((r) => r.id)).not.toContain(
      routineId,
    );

    const otherDay = await request(app.getHttpServer())
      .get('/api/v1/routines')
      .query({ galleryId, date: '2026-08-10' })
      .set('Authorization', `Bearer ${wardenToken}`);
    expect((otherDay.body as { data: { id: number }[] }).data.map((r) => r.id)).toContain(
      routineId,
    );

    // includeInactive=true (web management screen) must still show it on the
    // deactivated date, with `active` reflecting the true per-date status.
    const deactivatedDayIncludeInactive = await request(app.getHttpServer())
      .get('/api/v1/routines')
      .query({ galleryId, date: '2026-08-09', includeInactive: 'true' })
      .set('Authorization', `Bearer ${wardenToken}`);
    const row = (
      deactivatedDayIncludeInactive.body as { data: { id: number; active: boolean }[] }
    ).data.find((r) => r.id === routineId);
    expect(row).toMatchObject({ active: false });
  });

  it('rejects SUPERVISOR editing schedule/activation of a locked routine (403)', async () => {
    const galleryId = await createGallery();
    const routineId = await createRoutine(galleryId, { name: 'Pátio Padrão', locked: true });

    const scheduleRes = await request(app.getHttpServer())
      .patch(`/api/v1/routines/${routineId}/schedule`)
      .set('Authorization', `Bearer ${supervisorToken}`)
      .send({ schedules: [{ weekday: null, time: '10:00' }] });
    expect(scheduleRes.status).toBe(403);

    const activationRes = await request(app.getHttpServer())
      .patch(`/api/v1/routines/${routineId}/activation`)
      .set('Authorization', `Bearer ${supervisorToken}`)
      .send({ date: '2026-08-09', active: false });
    expect(activationRes.status).toBe(403);
  });

  it('allows WARDEN to edit schedule/activation of a locked routine', async () => {
    const galleryId = await createGallery();
    const routineId = await createRoutine(galleryId, { name: 'Pátio Padrão 2', locked: true });

    const scheduleRes = await request(app.getHttpServer())
      .patch(`/api/v1/routines/${routineId}/schedule`)
      .set('Authorization', `Bearer ${wardenToken}`)
      .send({ schedules: [{ weekday: null, time: '11:00' }] });
    expect(scheduleRes.status).toBe(200);

    const activationRes = await request(app.getHttpServer())
      .patch(`/api/v1/routines/${routineId}/activation`)
      .set('Authorization', `Bearer ${wardenToken}`)
      .send({ date: '2026-08-09', active: false });
    expect(activationRes.status).toBe(200);
  });

  it('deletes a non-locked routine and rejects deleting a locked one (409)', async () => {
    const galleryId = await createGallery();
    const routineId = await createRoutine(galleryId, { name: 'Removível', locked: false });
    const lockedId = await createRoutine(galleryId, {
      name: 'Fixa',
      locked: true,
      time: '10:00',
    });

    const deleteRes = await request(app.getHttpServer())
      .delete(`/api/v1/routines/${routineId}`)
      .set('Authorization', `Bearer ${wardenToken}`);
    expect(deleteRes.status).toBe(204);

    const deleteLockedRes = await request(app.getHttpServer())
      .delete(`/api/v1/routines/${lockedId}`)
      .set('Authorization', `Bearer ${wardenToken}`);
    expect(deleteLockedRes.status).toBe(409);
  });

  describe('overlapping schedules (spec.md Edge Cases)', () => {
    function postRoutine(galleryId: number, time: string, confirmOverlap?: boolean) {
      return request(app.getHttpServer())
        .post('/api/v1/routines')
        .set('Authorization', `Bearer ${wardenToken}`)
        .send({
          galleryId,
          name: `Rotina ${time}`,
          type: 'DAILY',
          schedules: [{ weekday: null, time }],
          confirmOverlap,
        });
    }

    it('warns with 409 and the overlapping routine, then saves once confirmed', async () => {
      const galleryId = await createGallery();
      const first = await postRoutine(galleryId, '14:00');
      expect(first.status).toBe(201);
      const firstId = (first.body as { id: number }).id;

      const warned = await postRoutine(galleryId, '14:00');
      expect(warned.status).toBe(409);
      expect(warned.body).toMatchObject({
        details: {
          code: 'ROUTINE_SCHEDULE_OVERLAP',
          overlaps: [{ routineId: firstId, time: '14:00' }],
        },
      });

      const confirmed = await postRoutine(galleryId, '14:00', true);
      expect(confirmed.status).toBe(201);
    });

    it('does not warn for a different time or a different gallery', async () => {
      const galleryId = await createGallery();
      const otherGalleryId = await createGallery();
      expect((await postRoutine(galleryId, '14:00')).status).toBe(201);

      expect((await postRoutine(galleryId, '15:00')).status).toBe(201);
      expect((await postRoutine(otherGalleryId, '14:00')).status).toBe(201);
    });

    it('does not warn for two different weekdays at the same time', async () => {
      const galleryId = await createGallery();
      await createRoutine(galleryId, { name: 'Segunda', weekday: 1, time: '14:00' });

      const res = await request(app.getHttpServer())
        .post('/api/v1/routines')
        .set('Authorization', `Bearer ${wardenToken}`)
        .send({
          galleryId,
          name: 'Terça',
          type: 'WEEKDAY',
          schedules: [{ weekday: 2, time: '14:00' }],
        });
      expect(res.status).toBe(201);
    });

    it('warns when a supervisor moves a schedule onto another routine, and lets them confirm', async () => {
      const galleryId = await createGallery();
      await createRoutine(galleryId, { name: 'Pátio', time: '14:00' });
      const movableId = await createRoutine(galleryId, { name: 'Faxina', time: '16:00' });
      const patch = (confirmOverlap?: boolean) =>
        request(app.getHttpServer())
          .patch(`/api/v1/routines/${movableId}/schedule`)
          .set('Authorization', `Bearer ${supervisorToken}`)
          .send({ schedules: [{ weekday: null, time: '14:00' }], confirmOverlap });

      expect((await patch()).status).toBe(409);
      expect((await patch(true)).status).toBe(200);
    });

    it('does not warn when re-saving a routine own schedule', async () => {
      const galleryId = await createGallery();
      const routineId = await createRoutine(galleryId, { name: 'Pátio', time: '14:00' });

      const res = await request(app.getHttpServer())
        .patch(`/api/v1/routines/${routineId}/schedule`)
        .set('Authorization', `Bearer ${supervisorToken}`)
        .send({ schedules: [{ weekday: null, time: '14:00' }] });
      expect(res.status).toBe(200);
    });
  });

  it('rejects creating a routine for a non-existent gallery (404) — reuses GalleriesService.findEntityInScope', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/routines')
      .set('Authorization', `Bearer ${wardenToken}`)
      .send({ galleryId: 999_999, name: 'Pátio', type: 'DAILY', schedules: [{ time: '09:00' }] });
    expect(res.status).toBe(404);
  });
});
