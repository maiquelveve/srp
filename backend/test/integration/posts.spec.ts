import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { TEST_FIXTURE } from './fixtures';

/**
 * Integration tests for the Postos de serviço endpoints of contracts/staff.md
 * (FR-022a): only WARDEN creates/renames/deactivates; SUPERVISOR only reads.
 */
describe('Posts endpoints (contracts/staff.md)', () => {
  let app: INestApplication;
  let wardenToken: string;
  let supervisorToken: string;
  let officerToken: string;
  let postCounter = 0;

  async function login(email: string): Promise<string> {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password: TEST_FIXTURE.password });
    return (res.body as { accessToken: string }).accessToken;
  }

  function uniqueName(prefix: string): string {
    postCounter += 1;
    return `${prefix}-${Date.now()}-${postCounter}`;
  }

  function createPost(token: string, body: Partial<{ unitId: number; name: string }> = {}) {
    return request(app.getHttpServer())
      .post('/api/v1/posts')
      .set('Authorization', `Bearer ${token}`)
      .send({ unitId: TEST_FIXTURE.unitAId, name: uniqueName('Posto'), ...body });
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

  it('rejects an unauthenticated request', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/posts');
    expect(res.status).toBe(401);
  });

  it('rejects PRISON_OFFICER on every posts endpoint (FR-002)', async () => {
    const auth = { Authorization: `Bearer ${officerToken}` };
    const server = app.getHttpServer();
    // Sequential on purpose: parallel supertest calls against the same
    // un-listened server intermittently fail with ECONNRESET.
    const responses = [
      await request(server).get('/api/v1/posts').set(auth),
      await request(server)
        .post('/api/v1/posts')
        .set(auth)
        .send({ unitId: TEST_FIXTURE.unitAId, name: 'X' }),
      await request(server).patch('/api/v1/posts/1').set(auth).send({ active: false }),
    ];
    for (const res of responses) {
      expect(res.status).toBe(403);
    }
  });

  describe('POST /posts (WARDEN only)', () => {
    it('lets WARDEN create a post, trimming the name', async () => {
      const name = uniqueName('Pórtico');
      const res = await createPost(wardenToken, { name: `  ${name}  ` });
      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ unitId: TEST_FIXTURE.unitAId, name, active: true });
    });

    it('answers 403 for SUPERVISOR', async () => {
      const res = await createPost(supervisorToken);
      expect(res.status).toBe(403);
    });

    it('answers 409 for a duplicate name in the same unit', async () => {
      const name = uniqueName('Garita');
      expect((await createPost(wardenToken, { name })).status).toBe(201);
      expect((await createPost(wardenToken, { name })).status).toBe(409);
    });

    it('rejects an empty or missing name (400)', async () => {
      expect((await createPost(wardenToken, { name: '   ' })).status).toBe(400);
      const withoutName = await request(app.getHttpServer())
        .post('/api/v1/posts')
        .set('Authorization', `Bearer ${wardenToken}`)
        .send({ unitId: TEST_FIXTURE.unitAId });
      expect(withoutName.status).toBe(400);
    });

    it('rejects a unit outside the caller scope (403) and an unknown unit (404)', async () => {
      expect((await createPost(wardenToken, { unitId: TEST_FIXTURE.unitBId })).status).toBe(403);
      expect((await createPost(wardenToken, { unitId: 999999 })).status).toBe(404);
    });
  });

  describe('PATCH /posts/:id (WARDEN only)', () => {
    it('renames and deactivates a post', async () => {
      const created = await createPost(wardenToken);
      const id = (created.body as { id: number }).id;
      const newName = uniqueName('A/B');

      const renamed = await request(app.getHttpServer())
        .patch(`/api/v1/posts/${id}`)
        .set('Authorization', `Bearer ${wardenToken}`)
        .send({ name: newName });
      expect(renamed.status).toBe(200);
      expect(renamed.body).toMatchObject({ id, name: newName, active: true });

      const deactivated = await request(app.getHttpServer())
        .patch(`/api/v1/posts/${id}`)
        .set('Authorization', `Bearer ${wardenToken}`)
        .send({ active: false });
      expect(deactivated.status).toBe(200);
      expect(deactivated.body).toMatchObject({ id, active: false });
    });

    it('answers 403 for SUPERVISOR', async () => {
      const created = await createPost(wardenToken);
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/posts/${(created.body as { id: number }).id}`)
        .set('Authorization', `Bearer ${supervisorToken}`)
        .send({ active: false });
      expect(res.status).toBe(403);
    });

    it('answers 409 when renaming to a name already used in the unit', async () => {
      const taken = uniqueName('Infopen');
      await createPost(wardenToken, { name: taken });
      const other = await createPost(wardenToken);
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/posts/${(other.body as { id: number }).id}`)
        .set('Authorization', `Bearer ${wardenToken}`)
        .send({ name: taken });
      expect(res.status).toBe(409);
    });

    it('answers 404 for an unknown post', async () => {
      const res = await request(app.getHttpServer())
        .patch('/api/v1/posts/999999')
        .set('Authorization', `Bearer ${wardenToken}`)
        .send({ active: false });
      expect(res.status).toBe(404);
    });
  });

  describe('GET /posts', () => {
    it('lets SUPERVISOR list, hiding inactive posts unless asked', async () => {
      const activeName = uniqueName('Ativo');
      const inactiveName = uniqueName('Inativo');
      await createPost(wardenToken, { name: activeName });
      const inactive = await createPost(wardenToken, { name: inactiveName });
      await request(app.getHttpServer())
        .patch(`/api/v1/posts/${(inactive.body as { id: number }).id}`)
        .set('Authorization', `Bearer ${wardenToken}`)
        .send({ active: false });

      const defaultList = await request(app.getHttpServer())
        .get(`/api/v1/posts?unitId=${TEST_FIXTURE.unitAId}`)
        .set('Authorization', `Bearer ${supervisorToken}`);
      expect(defaultList.status).toBe(200);
      const defaultNames = (defaultList.body as { data: { name: string }[] }).data.map(
        (post) => post.name,
      );
      expect(defaultNames).toContain(activeName);
      expect(defaultNames).not.toContain(inactiveName);

      const fullList = await request(app.getHttpServer())
        .get(`/api/v1/posts?unitId=${TEST_FIXTURE.unitAId}&includeInactive=true`)
        .set('Authorization', `Bearer ${wardenToken}`);
      const fullNames = (fullList.body as { data: { name: string }[] }).data.map(
        (post) => post.name,
      );
      expect(fullNames).toEqual(expect.arrayContaining([activeName, inactiveName]));
    });

    it('rejects a unit outside the caller scope (403)', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/posts?unitId=${TEST_FIXTURE.unitBId}`)
        .set('Authorization', `Bearer ${supervisorToken}`);
      expect(res.status).toBe(403);
    });
  });
});
