import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PasswordHasherService } from '../../src/auth/hashing/password-hasher.service';
import { TEST_FIXTURE } from './fixtures';

/**
 * contracts/auth.md (feature 002) — PATCH /api/v1/auth/change-password:
 * qualquer usuário autenticado troca a própria senha, revogando as demais
 * sessões e mantendo válida só a do refreshToken informado (FR-016/FR-017,
 * FR-017a, research.md #1).
 *
 * Reaproveita um único usuário/sessão entre os testes que não chegam a
 * trocar a senha (login tem throttle próprio, contracts/auth.md feature
 * 001) — só o teste que efetivamente troca a senha precisa de logins
 * extras para provar a revogação de sessão.
 */
describe('Self password change (contracts/auth.md)', () => {
  let app: INestApplication;
  let wardenToken: string;
  let officer: { userId: number; email: string; accessToken: string; refreshToken: string };

  async function login(email: string, password: string) {
    return request(app.getHttpServer()).post('/api/v1/auth/login').send({ email, password });
  }

  function changePassword(accessToken: string, body: Record<string, unknown>) {
    return request(app.getHttpServer())
      .patch('/api/v1/auth/change-password')
      .set('Authorization', `Bearer ${accessToken}`)
      .send(body);
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();

    const wardenRes = await login(TEST_FIXTURE.wardenEmail, TEST_FIXTURE.password);
    wardenToken = (wardenRes.body as { accessToken: string }).accessToken;

    const email = `change-password-${Date.now()}@test.srp.rs.gov.br`;
    const created = await request(app.getHttpServer())
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${wardenToken}`)
      .send({
        name: 'Policial Troca de Senha',
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
    officer = { userId, email, accessToken: body.accessToken, refreshToken: body.refreshToken };
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects a wrong current password without changing anything', async () => {
    const res = await changePassword(officer.accessToken, {
      currentPassword: 'senha-errada',
      newPassword: 'NovaSenha@123',
      refreshToken: officer.refreshToken,
    });
    expect(res.status).toBe(400);
  });

  it('rejects a new password that does not meet the policy (min 8 chars)', async () => {
    const res = await changePassword(officer.accessToken, {
      currentPassword: TEST_FIXTURE.password,
      newPassword: 'short',
      refreshToken: officer.refreshToken,
    });
    expect(res.status).toBe(400);
  });

  it('changes the password and revokes every other session, keeping only the current one', async () => {
    // Segunda sessão (outro dispositivo/aba) para o mesmo usuário.
    const secondSession = await login(officer.email, TEST_FIXTURE.password);
    expect(secondSession.status).toBe(201);
    const secondSessionBody = secondSession.body as { accessToken: string; refreshToken: string };

    // `iat` do JWT só tem resolução de segundo inteiro (jwt.strategy.ts) —
    // espera cruzar pra um segundo cheio diferente antes de trocar a senha,
    // senão o teste fica dependente de sorte quanto ao instante exato em
    // que cada requisição cai.
    await new Promise((resolve) => setTimeout(resolve, 1100));

    const newPassword = 'NovaSenha@123';
    const res = await changePassword(officer.accessToken, {
      currentPassword: TEST_FIXTURE.password,
      newPassword,
      refreshToken: officer.refreshToken,
    });
    expect(res.status).toBe(200);

    // Login seguinte só funciona com a senha nova.
    expect((await login(officer.email, TEST_FIXTURE.password)).status).toBe(401);
    expect((await login(officer.email, newPassword)).status).toBe(201);

    // A segunda sessão é rejeitada JÁ na próxima requisição, mesmo com um
    // access token ainda não expirado — revogar só o refresh token não
    // bastaria, essa aba continuaria "logada" por até 15 min (FR-017a).
    const secondSessionRequest = await request(app.getHttpServer())
      .get('/api/v1/units')
      .set('Authorization', `Bearer ${secondSessionBody.accessToken}`);
    expect(secondSessionRequest.status).toBe(401);
    // ...e o refresh token dela também foi revogado (não dá nem pra pedir um novo access token).
    const revokedRefresh = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: secondSessionBody.refreshToken });
    expect(revokedRefresh.status).toBe(401);

    // A mesma rejeição vale pro access token ANTIGO da própria sessão que
    // fez a troca (emitido antes dela) — o frontend nunca percebe isso: o
    // interceptor do axios renova sozinho no próximo 401 (api-client.ts).
    const staleCurrentRequest = await request(app.getHttpServer())
      .get('/api/v1/units')
      .set('Authorization', `Bearer ${officer.accessToken}`);
    expect(staleCurrentRequest.status).toBe(401);

    // Mas o refresh token dessa sessão continua válido — dá um access token
    // NOVO (emitido depois da troca), que passa normalmente.
    const keptRefresh = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: officer.refreshToken });
    expect(keptRefresh.status).toBe(200);
    const newAccessToken = (keptRefresh.body as { accessToken: string }).accessToken;
    const keptRequest = await request(app.getHttpServer())
      .get('/api/v1/units')
      .set('Authorization', `Bearer ${newAccessToken}`);
    expect(keptRequest.status).toBe(200);
  });
});
