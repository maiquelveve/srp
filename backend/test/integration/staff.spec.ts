import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { TEST_FIXTURE } from './fixtures';

/**
 * Integration tests for contracts/staff.md — User Story 5 (Controle de
 * Efetivo), against the isolated `srp_db_test` database prepared by
 * `pretest:integration` (research.md #1). Each test uses its own date so
 * schedules never collide on the (user, date, shift) unique constraint.
 */
describe('Staff endpoints (contracts/staff.md)', () => {
  let app: INestApplication;
  let wardenToken: string;
  let supervisorToken: string;
  let officerToken: string;
  let officerId: number;
  let postCounter = 0;

  async function login(email: string): Promise<string> {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password: TEST_FIXTURE.password });
    return (res.body as { accessToken: string }).accessToken;
  }

  /** Posts are created by WARDEN only (FR-022a); every test makes its own to stay isolated. */
  async function createPost(prefix = 'Posto'): Promise<{ id: number; name: string }> {
    postCounter += 1;
    const res = await request(app.getHttpServer())
      .post('/api/v1/posts')
      .set('Authorization', `Bearer ${wardenToken}`)
      .send({ unitId: TEST_FIXTURE.unitAId, name: `${prefix}-${Date.now()}-${postCounter}` });
    return res.body as { id: number; name: string };
  }

  type Assignment = { shift: string; postId: number };

  /** Registers the officer's day: one schedule per assignment (shift + post), all-or-nothing. */
  function createDay(
    token: string,
    assignments: Assignment[],
    body: Partial<{ userId: number; unitId: number; date: string; workloadHours: number }> = {},
  ): request.Test {
    return request(app.getHttpServer())
      .post('/api/v1/schedules')
      .set('Authorization', `Bearer ${token}`)
      .send({
        userId: officerId,
        unitId: TEST_FIXTURE.unitAId,
        date: '2030-01-01',
        workloadHours: 12,
        assignments,
        ...body,
      });
  }

  /** Single-shift shortcut for tests that only need one schedule and read `data[0]`. */
  function createSchedule(
    token: string,
    body: { postId: number; shift?: string } & Partial<{
      userId: number;
      unitId: number;
      date: string;
      workloadHours: number;
    }>,
  ): request.Test {
    const { postId, shift, ...rest } = body;
    return createDay(token, [{ shift: shift ?? 'DAY', postId }], rest);
  }

  function firstScheduled(res: request.Response): { id: number } & Record<string, unknown> {
    return (res.body as { data: ({ id: number } & Record<string, unknown>)[] }).data[0];
  }

  function saveMinimum(
    token: string,
    body: { postId: number; shift: string; minimumHeadcount: number },
  ): request.Test {
    return request(app.getHttpServer())
      .patch('/api/v1/staff/minimum-staffing-config')
      .set('Authorization', `Bearer ${token}`)
      .send(body);
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

    const officers = await request(app.getHttpServer())
      .get('/api/v1/users?role=PRISON_OFFICER')
      .set('Authorization', `Bearer ${wardenToken}`);
    officerId = (officers.body as { data: { id: number; email: string }[] }).data.find(
      (user) => user.email === TEST_FIXTURE.officerEmail,
    )!.id;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('access control (FR-002)', () => {
    it('rejects an unauthenticated request', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/schedules');
      expect(res.status).toBe(401);
    });

    it('rejects PRISON_OFFICER on every staff endpoint', async () => {
      const post = await createPost();
      const auth = { Authorization: `Bearer ${officerToken}` };
      const server = app.getHttpServer();
      // Sequential on purpose: parallel supertest calls against the same
      // un-listened server intermittently fail with ECONNRESET.
      const responses = [
        await request(server).get('/api/v1/schedules').set(auth),
        await request(server)
          .post('/api/v1/schedules')
          .set(auth)
          .send({
            userId: officerId,
            unitId: TEST_FIXTURE.unitAId,
            date: '2030-02-01',
            workloadHours: 12,
            assignments: [{ shift: 'DAY', postId: post.id }],
          }),
        await request(server)
          .patch('/api/v1/schedules/1/attendance')
          .set(auth)
          .send({ attendanceStatus: 'PRESENT' }),
        await request(server)
          .get('/api/v1/schedules/minimum-staffing?date=2030-02-01&shift=DAY')
          .set(auth),
        await request(server)
          .patch('/api/v1/staff/minimum-staffing-config')
          .set(auth)
          .send({ postId: post.id, shift: 'NIGHT', minimumHeadcount: 3 }),
      ];
      for (const res of responses) {
        expect(res.status).toBe(403);
      }
    });
  });

  describe('POST /schedules (FR-021/FR-022/FR-022b)', () => {
    it('lets SUPERVISOR and WARDEN schedule an officer at a post with the day workload', async () => {
      const post = await createPost();
      const bySupervisor = await createSchedule(supervisorToken, {
        postId: post.id,
        date: '2030-03-01',
        shift: 'DAY',
        workloadHours: 24,
      });
      expect(bySupervisor.status).toBe(201);
      expect(firstScheduled(bySupervisor)).toMatchObject({
        userId: officerId,
        unitId: TEST_FIXTURE.unitAId,
        postId: post.id,
        postName: post.name,
        date: '2030-03-01',
        shift: 'DAY',
        workloadHours: 24,
        attendanceStatus: null,
      });

      const byWarden = await createSchedule(wardenToken, {
        postId: post.id,
        date: '2030-03-01',
        shift: 'NIGHT',
        workloadHours: 24,
      });
      expect(byWarden.status).toBe(201);
    });

    it('lets the officer change post between the shifts of the same day', async () => {
      const dayPost = await createPost('Dia');
      const nightPost = await createPost('Noite');
      const day = await createSchedule(wardenToken, {
        postId: dayPost.id,
        date: '2030-03-02',
        shift: 'DAY',
        workloadHours: 24,
      });
      const night = await createSchedule(wardenToken, {
        postId: nightPost.id,
        date: '2030-03-02',
        shift: 'NIGHT',
        workloadHours: 24,
      });
      expect(day.status).toBe(201);
      expect(night.status).toBe(201);
      expect(firstScheduled(night)).toMatchObject({ postId: nightPost.id, workloadHours: 24 });
    });

    it('answers 422 when the workload differs from the one already set for that day', async () => {
      const post = await createPost();
      await createSchedule(wardenToken, {
        postId: post.id,
        date: '2030-03-03',
        shift: 'DAY',
        workloadHours: 24,
      });
      const mismatch = await createSchedule(wardenToken, {
        postId: post.id,
        date: '2030-03-03',
        shift: 'NIGHT',
        workloadHours: 12,
      });
      expect(mismatch.status).toBe(422);
    });

    it('answers 409 on a duplicate (user, date, shift)', async () => {
      const post = await createPost();
      const otherPost = await createPost();
      const first = await createSchedule(wardenToken, {
        postId: post.id,
        date: '2030-03-04',
        shift: 'NIGHT',
      });
      expect(first.status).toBe(201);
      const duplicate = await createSchedule(wardenToken, {
        postId: otherPost.id,
        date: '2030-03-04',
        shift: 'NIGHT',
      });
      expect(duplicate.status).toBe(409);
    });

    it('rejects an invalid shift, date or workload (400)', async () => {
      const post = await createPost();
      const base = { postId: post.id, date: '2030-03-05' };
      // The old three-shift values are no longer valid: there are only DAY and NIGHT.
      expect((await createSchedule(wardenToken, { ...base, shift: 'MORNING' })).status).toBe(400);
      expect((await createSchedule(wardenToken, { ...base, shift: 'AFTERNOON' })).status).toBe(400);
      expect((await createSchedule(wardenToken, { ...base, date: 'not-a-date' })).status).toBe(400);
      expect((await createSchedule(wardenToken, { ...base, workloadHours: 0 })).status).toBe(400);
      expect((await createSchedule(wardenToken, { ...base, workloadHours: 25 })).status).toBe(400);
    });

    it('requires the workload (400)', async () => {
      const post = await createPost();
      const res = await request(app.getHttpServer())
        .post('/api/v1/schedules')
        .set('Authorization', `Bearer ${wardenToken}`)
        .send({
          userId: officerId,
          unitId: TEST_FIXTURE.unitAId,
          date: '2030-03-06',
          assignments: [{ shift: 'DAY', postId: post.id }],
        });
      expect(res.status).toBe(400);
    });

    it('rejects an inactive post (400) and an unknown post (404)', async () => {
      const post = await createPost();
      await request(app.getHttpServer())
        .patch(`/api/v1/posts/${post.id}`)
        .set('Authorization', `Bearer ${wardenToken}`)
        .send({ active: false });
      expect(
        (await createSchedule(wardenToken, { postId: post.id, date: '2030-03-07' })).status,
      ).toBe(400);
      expect(
        (await createSchedule(wardenToken, { postId: 999999, date: '2030-03-07' })).status,
      ).toBe(404);
    });

    it('rejects a user that is not a PRISON_OFFICER (400)', async () => {
      const post = await createPost();
      const supervisors = await request(app.getHttpServer())
        .get('/api/v1/users?role=SUPERVISOR')
        .set('Authorization', `Bearer ${wardenToken}`);
      const supervisorId = (supervisors.body as { data: { id: number }[] }).data[0].id;
      const res = await createSchedule(wardenToken, {
        postId: post.id,
        userId: supervisorId,
        date: '2030-03-08',
      });
      expect(res.status).toBe(400);
    });

    it('answers 404 for an unknown officer', async () => {
      const post = await createPost();
      const res = await createSchedule(wardenToken, {
        postId: post.id,
        userId: 999999,
        date: '2030-03-09',
      });
      expect(res.status).toBe(404);
    });

    it('rejects a unit outside the caller scope (403)', async () => {
      const post = await createPost();
      const res = await createSchedule(wardenToken, {
        postId: post.id,
        unitId: TEST_FIXTURE.unitBId,
        date: '2030-03-10',
      });
      expect(res.status).toBe(403);
    });
  });

  describe('POST /schedules registers the whole day at once (FR-022/FR-022b)', () => {
    it('creates the day and night schedules in one call, each with its own post', async () => {
      const dayPost = await createPost('Dia');
      const nightPost = await createPost('Noite');
      const res = await createDay(
        wardenToken,
        [
          { shift: 'DAY', postId: dayPost.id },
          { shift: 'NIGHT', postId: nightPost.id },
        ],
        { date: '2030-03-20', workloadHours: 24 },
      );
      expect(res.status).toBe(201);
      const body = res.body as {
        data: { shift: string; postId: number; workloadHours: number }[];
        total: number;
      };
      expect(body.total).toBe(2);
      expect(body.data).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ shift: 'DAY', postId: dayPost.id, workloadHours: 24 }),
          expect.objectContaining({ shift: 'NIGHT', postId: nightPost.id, workloadHours: 24 }),
        ]),
      );
    });

    it('creates nothing when one of the assignments is invalid (all or nothing)', async () => {
      const activePost = await createPost();
      const inactivePost = await createPost();
      await request(app.getHttpServer())
        .patch(`/api/v1/posts/${inactivePost.id}`)
        .set('Authorization', `Bearer ${wardenToken}`)
        .send({ active: false });

      const res = await createDay(
        wardenToken,
        [
          { shift: 'DAY', postId: activePost.id },
          { shift: 'NIGHT', postId: inactivePost.id },
        ],
        { date: '2030-03-21' },
      );
      expect(res.status).toBe(400);

      const list = await request(app.getHttpServer())
        .get('/api/v1/schedules?date=2030-03-21')
        .set('Authorization', `Bearer ${wardenToken}`);
      expect((list.body as { total: number }).total).toBe(0);
    });

    it('lets the officer be added to the other shift later, with the same workload', async () => {
      const dayPost = await createPost();
      const nightPost = await createPost();
      const first = await createDay(wardenToken, [{ shift: 'DAY', postId: dayPost.id }], {
        date: '2030-03-22',
        workloadHours: 24,
      });
      expect(first.status).toBe(201);

      const mismatch = await createDay(wardenToken, [{ shift: 'NIGHT', postId: nightPost.id }], {
        date: '2030-03-22',
        workloadHours: 12,
      });
      expect(mismatch.status).toBe(422);

      const second = await createDay(wardenToken, [{ shift: 'NIGHT', postId: nightPost.id }], {
        date: '2030-03-22',
        workloadHours: 24,
      });
      expect(second.status).toBe(201);
    });

    it('answers 409 when any requested shift is already scheduled for that day', async () => {
      const post = await createPost();
      await createDay(wardenToken, [{ shift: 'DAY', postId: post.id }], { date: '2030-03-23' });
      const res = await createDay(
        wardenToken,
        [
          { shift: 'DAY', postId: post.id },
          { shift: 'NIGHT', postId: post.id },
        ],
        { date: '2030-03-23' },
      );
      expect(res.status).toBe(409);
      const list = await request(app.getHttpServer())
        .get('/api/v1/schedules?date=2030-03-23&shift=NIGHT')
        .set('Authorization', `Bearer ${wardenToken}`);
      expect((list.body as { total: number }).total).toBe(0);
    });

    it('rejects an empty list, a repeated shift, or more than two assignments (400)', async () => {
      const post = await createPost();
      const base = { date: '2030-03-24' };
      expect((await createDay(wardenToken, [], base)).status).toBe(400);
      const repeated = await createDay(
        wardenToken,
        [
          { shift: 'DAY', postId: post.id },
          { shift: 'DAY', postId: post.id },
        ],
        base,
      );
      expect(repeated.status).toBe(400);
      const tooMany = await createDay(
        wardenToken,
        [
          { shift: 'DAY', postId: post.id },
          { shift: 'NIGHT', postId: post.id },
          { shift: 'DAY', postId: post.id },
        ],
        base,
      );
      expect(tooMany.status).toBe(400);
    });
  });

  describe('GET /schedules (FR-022)', () => {
    it('filters by date, shift and post', async () => {
      const galleryPost = await createPost('Galeria');
      const gatePost = await createPost('Pórtico');
      await createSchedule(wardenToken, {
        postId: galleryPost.id,
        date: '2030-04-01',
        shift: 'DAY',
      });
      await createSchedule(wardenToken, {
        postId: gatePost.id,
        date: '2030-04-01',
        shift: 'NIGHT',
      });

      const res = await request(app.getHttpServer())
        .get(`/api/v1/schedules?date=2030-04-01&shift=NIGHT&postId=${gatePost.id}`)
        .set('Authorization', `Bearer ${supervisorToken}`);
      expect(res.status).toBe(200);
      const body = res.body as {
        data: { shift: string; postName: string; workloadHours: number }[];
        total: number;
      };
      expect(body.total).toBe(1);
      expect(body.data[0]).toMatchObject({
        shift: 'NIGHT',
        postName: gatePost.name,
        workloadHours: 12,
      });
    });

    it('includes the officer name so the roster is readable', async () => {
      const post = await createPost();
      await createSchedule(wardenToken, { postId: post.id, date: '2030-04-02' });
      const res = await request(app.getHttpServer())
        .get('/api/v1/schedules?date=2030-04-02')
        .set('Authorization', `Bearer ${supervisorToken}`);
      const body = res.body as { data: { userName: string }[] };
      expect(body.data[0].userName).toBe('Officer Test');
    });
  });

  describe('PATCH /schedules/:id/attendance (FR-023)', () => {
    async function scheduleId(date: string): Promise<number> {
      const post = await createPost();
      const res = await createSchedule(wardenToken, { postId: post.id, date });
      return firstScheduled(res).id;
    }

    it('records presence', async () => {
      const id = await scheduleId('2030-05-01');
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/schedules/${id}/attendance`)
        .set('Authorization', `Bearer ${supervisorToken}`)
        .send({ attendanceStatus: 'PRESENT' });
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ id, attendanceStatus: 'PRESENT' });
    });

    it('records an absence with its reason', async () => {
      const id = await scheduleId('2030-05-02');
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/schedules/${id}/attendance`)
        .set('Authorization', `Bearer ${wardenToken}`)
        .send({ attendanceStatus: 'ABSENT', absenceReason: 'Atestado médico' });
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        attendanceStatus: 'ABSENT',
        absenceReason: 'Atestado médico',
      });
    });

    it('rejects an unknown status (400)', async () => {
      const id = await scheduleId('2030-05-03');
      const badStatus = await request(app.getHttpServer())
        .patch(`/api/v1/schedules/${id}/attendance`)
        .set('Authorization', `Bearer ${wardenToken}`)
        .send({ attendanceStatus: 'LATE' });
      expect(badStatus.status).toBe(400);
    });

    it('answers 404 for an unknown schedule', async () => {
      const res = await request(app.getHttpServer())
        .patch('/api/v1/schedules/999999/attendance')
        .set('Authorization', `Bearer ${wardenToken}`)
        .send({ attendanceStatus: 'PRESENT' });
      expect(res.status).toBe(404);
    });
  });

  describe('PATCH /staff/minimum-staffing-config (FR-024, research.md #12)', () => {
    it('answers 403 for SUPERVISOR and PRISON_OFFICER', async () => {
      const post = await createPost();
      for (const token of [supervisorToken, officerToken]) {
        const res = await saveMinimum(token, {
          postId: post.id,
          shift: 'NIGHT',
          minimumHeadcount: 3,
        });
        expect(res.status).toBe(403);
      }
    });

    it('lets WARDEN create and then update the value (upsert, persisted)', async () => {
      const post = await createPost();
      const created = await saveMinimum(wardenToken, {
        postId: post.id,
        shift: 'NIGHT',
        minimumHeadcount: 3,
      });
      expect(created.status).toBe(200);
      expect(created.body).toEqual({ postId: post.id, shift: 'NIGHT', minimumHeadcount: 3 });

      const updated = await saveMinimum(wardenToken, {
        postId: post.id,
        shift: 'NIGHT',
        minimumHeadcount: 4,
      });
      expect(updated.status).toBe(200);
      expect(updated.body).toMatchObject({ minimumHeadcount: 4 });

      // Persistence is observable through the report, which reads the table.
      const report = await request(app.getHttpServer())
        .get('/api/v1/schedules/minimum-staffing?date=2030-06-01&shift=NIGHT')
        .set('Authorization', `Bearer ${wardenToken}`);
      const posts = (report.body as { posts: { postId: number; minimum: number }[] }).posts;
      expect(posts.find((entry) => entry.postId === post.id)?.minimum).toBe(4);
    });

    it('rejects a non-positive minimum or unknown shift (400)', async () => {
      const post = await createPost();
      const valid = { postId: post.id, shift: 'NIGHT', minimumHeadcount: 3 };
      for (const invalid of [{ minimumHeadcount: 0 }, { minimumHeadcount: -2 }, { shift: 'X' }]) {
        const res = await saveMinimum(wardenToken, { ...valid, ...invalid });
        expect(res.status).toBe(400);
      }
    });

    it('answers 404 for an unknown post', async () => {
      const res = await saveMinimum(wardenToken, {
        postId: 999999,
        shift: 'NIGHT',
        minimumHeadcount: 3,
      });
      expect(res.status).toBe(404);
    });
  });

  describe('GET /schedules/minimum-staffing (FR-024)', () => {
    it('reports staffed vs configured minimum and flags the deficit', async () => {
      const post = await createPost();
      await saveMinimum(wardenToken, { postId: post.id, shift: 'NIGHT', minimumHeadcount: 3 });
      await createSchedule(wardenToken, { postId: post.id, date: '2030-07-01', shift: 'NIGHT' });

      const res = await request(app.getHttpServer())
        .get('/api/v1/schedules/minimum-staffing?date=2030-07-01&shift=NIGHT')
        .set('Authorization', `Bearer ${supervisorToken}`);
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ date: '2030-07-01', shift: 'NIGHT' });
      expect((res.body as { posts: unknown[] }).posts).toContainEqual({
        postId: post.id,
        postName: post.name,
        staffed: 1,
        absent: 0,
        minimum: 3,
        belowMinimum: true,
      });
    });

    it('does not flag a post that meets its minimum', async () => {
      const post = await createPost();
      await saveMinimum(wardenToken, { postId: post.id, shift: 'DAY', minimumHeadcount: 1 });
      await createSchedule(wardenToken, { postId: post.id, date: '2030-07-02', shift: 'DAY' });

      const res = await request(app.getHttpServer())
        .get('/api/v1/schedules/minimum-staffing?date=2030-07-02&shift=DAY')
        .set('Authorization', `Bearer ${wardenToken}`);
      expect((res.body as { posts: unknown[] }).posts).toContainEqual({
        postId: post.id,
        postName: post.name,
        staffed: 1,
        absent: 0,
        minimum: 1,
        belowMinimum: false,
      });
    });

    it('lists a post with a minimum but nobody scheduled as the worst deficit', async () => {
      const post = await createPost();
      await saveMinimum(wardenToken, { postId: post.id, shift: 'DAY', minimumHeadcount: 2 });

      const res = await request(app.getHttpServer())
        .get('/api/v1/schedules/minimum-staffing?date=2030-07-03&shift=DAY')
        .set('Authorization', `Bearer ${wardenToken}`);
      expect((res.body as { posts: unknown[] }).posts).toContainEqual({
        postId: post.id,
        postName: post.name,
        staffed: 0,
        absent: 0,
        minimum: 2,
        belowMinimum: true,
      });
    });

    it('ignores the minimum of a deactivated post', async () => {
      const post = await createPost();
      await saveMinimum(wardenToken, { postId: post.id, shift: 'DAY', minimumHeadcount: 2 });
      await request(app.getHttpServer())
        .patch(`/api/v1/posts/${post.id}`)
        .set('Authorization', `Bearer ${wardenToken}`)
        .send({ active: false });

      const res = await request(app.getHttpServer())
        .get('/api/v1/schedules/minimum-staffing?date=2030-07-04&shift=DAY')
        .set('Authorization', `Bearer ${wardenToken}`);
      const posts = (res.body as { posts: { postId: number }[] }).posts;
      expect(posts.find((entry) => entry.postId === post.id)).toBeUndefined();
    });

    it('discounts an absent officer from the staffed count and reports the absence', async () => {
      const post = await createPost();
      await saveMinimum(wardenToken, { postId: post.id, shift: 'DAY', minimumHeadcount: 1 });
      const scheduled = await createSchedule(wardenToken, {
        postId: post.id,
        date: '2030-07-05',
        shift: 'DAY',
      });

      const report = async (): Promise<unknown[]> => {
        const res = await request(app.getHttpServer())
          .get('/api/v1/schedules/minimum-staffing?date=2030-07-05&shift=DAY')
          .set('Authorization', `Bearer ${wardenToken}`);
        return (res.body as { posts: unknown[] }).posts;
      };

      // Scheduled and not yet marked: counts as staffed.
      expect(await report()).toContainEqual({
        postId: post.id,
        postName: post.name,
        staffed: 1,
        absent: 0,
        minimum: 1,
        belowMinimum: false,
      });

      // A falta leaves the post empty: it stops counting and the post falls below its minimum.
      await request(app.getHttpServer())
        .patch(`/api/v1/schedules/${firstScheduled(scheduled).id}/attendance`)
        .set('Authorization', `Bearer ${wardenToken}`)
        .send({ attendanceStatus: 'ABSENT', absenceReason: 'Atestado médico' });
      expect(await report()).toContainEqual({
        postId: post.id,
        postName: post.name,
        staffed: 0,
        absent: 1,
        minimum: 1,
        belowMinimum: true,
      });

      // Present again: back to counting.
      await request(app.getHttpServer())
        .patch(`/api/v1/schedules/${firstScheduled(scheduled).id}/attendance`)
        .set('Authorization', `Bearer ${wardenToken}`)
        .send({ attendanceStatus: 'PRESENT' });
      expect(await report()).toContainEqual({
        postId: post.id,
        postName: post.name,
        staffed: 1,
        absent: 0,
        minimum: 1,
        belowMinimum: false,
      });
    });

    it('applies the attendance to every schedule of the officer on that date', async () => {
      const dayPost = await createPost();
      const nightPost = await createPost();
      const created = await createDay(
        wardenToken,
        [
          { shift: 'DAY', postId: dayPost.id },
          { shift: 'NIGHT', postId: nightPost.id },
        ],
        { date: '2030-07-06', workloadHours: 24 },
      );
      const { id } = firstScheduled(created);
      await request(app.getHttpServer())
        .patch(`/api/v1/schedules/${id}/attendance`)
        .set('Authorization', `Bearer ${wardenToken}`)
        .send({ attendanceStatus: 'ABSENT' });

      const res = await request(app.getHttpServer())
        .get('/api/v1/schedules?date=2030-07-06')
        .set('Authorization', `Bearer ${wardenToken}`);
      const mine = (res.body as { data: { userId: number; attendanceStatus: string }[] }).data
        .filter((schedule) => schedule.userId === officerId)
        .map((schedule) => schedule.attendanceStatus);
      expect(mine).toEqual(['ABSENT', 'ABSENT']);
    });

    it('requires date and shift (400)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/schedules/minimum-staffing')
        .set('Authorization', `Bearer ${wardenToken}`);
      expect(res.status).toBe(400);
    });
  });
});
