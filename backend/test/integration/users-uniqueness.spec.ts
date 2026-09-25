import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { TEST_FIXTURE } from './fixtures';

/**
 * FR-030 — creating a user that collides on e-mail or matrícula answers 409
 * (never 500), including when two creations arrive at the same time.
 */
describe('User creation uniqueness (FR-030)', () => {
  let app: INestApplication;
  let wardenToken: string;
  const suffix = Date.now().toString().slice(-8);

  function newUserBody(tag: string, overrides: Record<string, unknown> = {}) {
    return {
      name: `Policial ${tag}`,
      email: `uniq.${tag}.${suffix}@srp.rs.gov.br`,
      badgeNumber: `UQ-${tag}-${suffix}`,
      role: 'PRISON_OFFICER',
      unitIds: [TEST_FIXTURE.unitAId],
      ...overrides,
    };
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();

    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: TEST_FIXTURE.wardenEmail, password: TEST_FIXTURE.password });
    wardenToken = (res.body as { accessToken: string }).accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  function create(body: Record<string, unknown>, url?: string) {
    return request(url ?? app.getHttpServer())
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${wardenToken}`)
      .send(body);
  }

  it('rejects a duplicate matrícula with 409', async () => {
    const first = await create(newUserBody('badge-a'));
    expect(first.status).toBe(201);

    const duplicate = await create(
      newUserBody('badge-b', { badgeNumber: newUserBody('badge-a').badgeNumber }),
    );

    expect(duplicate.status).toBe(409);
    expect((duplicate.body as { message: string }).message).toContain('matrícula');
  });

  it('rejects a duplicate e-mail with 409', async () => {
    expect((await create(newUserBody('mail-a'))).status).toBe(201);

    const duplicate = await create(newUserBody('mail-b', { email: newUserBody('mail-a').email }));

    expect(duplicate.status).toBe(409);
    expect((duplicate.body as { message: string }).message).toContain('e-mail');
  });

  it('answers one 201 and the rest 409 for simultaneous creations with the same e-mail', async () => {
    await app.listen(0);
    const url = await app.getUrl();
    const email = newUserBody('race-mail').email;

    const responses = await Promise.all(
      Array.from({ length: 6 }, (_, index) =>
        create(
          newUserBody(`race-mail-${index}`, { email, badgeNumber: `UQ-RM-${index}-${suffix}` }),
          url,
        ),
      ),
    );

    expect(responses.map((response) => response.status).sort()).toEqual([
      201, 409, 409, 409, 409, 409,
    ]);
  });

  it('answers one 201 and the rest 409 for simultaneous creations with the same matrícula', async () => {
    const url = await app.getUrl();
    const badgeNumber = `UQ-RACE-${suffix}`;

    const responses = await Promise.all(
      Array.from({ length: 6 }, (_, index) =>
        create(newUserBody(`race-badge-${index}`, { badgeNumber }), url),
      ),
    );

    expect(responses.map((response) => response.status).sort()).toEqual([
      201, 409, 409, 409, 409, 409,
    ]);
  });
});
