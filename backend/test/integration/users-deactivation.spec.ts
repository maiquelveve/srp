import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PasswordHasherService } from '../../src/auth/hashing/password-hasher.service';
import { TEST_FIXTURE } from './fixtures';

/**
 * FR-031 — a deactivated user MUST lose the ability to authenticate
 * immediately: live access token, refresh token and login all stop working.
 */
describe('User deactivation (FR-031)', () => {
  let app: INestApplication;
  let wardenToken: string;
  let userCounter = 0;

  async function login(email: string, password: string) {
    return request(app.getHttpServer()).post('/api/v1/auth/login').send({ email, password });
  }

  /** Creates an officer and sets a known password directly (skips the invite flow). */
  async function createLoggedInOfficer() {
    userCounter += 1;
    const email = `deactivation-${Date.now()}-${userCounter}@test.srp.rs.gov.br`;
    const created = await request(app.getHttpServer())
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${wardenToken}`)
      .send({
        name: 'Policial Desativação',
        email,
        role: 'PRISON_OFFICER',
        unitIds: [TEST_FIXTURE.unitAId],
      });
    expect(created.status).toBe(201);
    const userId = (created.body as { id: number }).id;

    const passwordHash = await app.get(PasswordHasherService).hash(TEST_FIXTURE.password);
    await app
      .get(DataSource)
      .query('UPDATE users SET password_hash = $1 WHERE id = $2', [passwordHash, userId]);

    const res = await login(email, TEST_FIXTURE.password);
    expect(res.status).toBe(201);
    const body = res.body as { accessToken: string; refreshToken: string };
    return { userId, email, accessToken: body.accessToken, refreshToken: body.refreshToken };
  }

  function deactivate(userId: number) {
    return request(app.getHttpServer())
      .patch(`/api/v1/users/${userId}/deactivate`)
      .set('Authorization', `Bearer ${wardenToken}`);
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();

    const res = await login(TEST_FIXTURE.wardenEmail, TEST_FIXTURE.password);
    wardenToken = (res.body as { accessToken: string }).accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects a still-valid access token right after deactivation', async () => {
    const officer = await createLoggedInOfficer();
    const before = await request(app.getHttpServer())
      .get('/api/v1/inmates')
      .set('Authorization', `Bearer ${officer.accessToken}`);
    expect(before.status).toBe(200);

    expect((await deactivate(officer.userId)).status).toBe(200);

    const after = await request(app.getHttpServer())
      .get('/api/v1/inmates')
      .set('Authorization', `Bearer ${officer.accessToken}`);
    expect(after.status).toBe(401);
  });

  it('rejects refreshing a token issued before the deactivation', async () => {
    const officer = await createLoggedInOfficer();
    expect((await deactivate(officer.userId)).status).toBe(200);

    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: officer.refreshToken });
    expect(res.status).toBe(401);
  });

  it('rejects a new login after deactivation', async () => {
    const officer = await createLoggedInOfficer();
    expect((await deactivate(officer.userId)).status).toBe(200);

    const res = await login(officer.email, TEST_FIXTURE.password);
    expect(res.status).toBe(401);
  });
});
