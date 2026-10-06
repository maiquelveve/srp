import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PasswordHasherService } from '../../src/auth/hashing/password-hasher.service';
import { TEST_FIXTURE } from './fixtures';

/**
 * contracts/users.md (feature 002) — administração de usuários pela
 * Chefia/Diretor: editar, reativar, trocar/adicionar lotação, resetar senha,
 * reenviar e-mail. Não há SMTP real no ambiente de teste, então todo envio
 * de e-mail aqui resulta em `emailDelivered: false` (research.md #6) — o que
 * é exatamente o cenário que FR-002a/FR-007a exigem não falhar a operação.
 */
describe('User administration (contracts/users.md)', () => {
  let app: INestApplication;
  let wardenToken: string;
  let wardenId: number;
  let supervisorToken: string;
  let officerToken: string;
  let userCounter = 0;

  async function login(email: string, password: string) {
    return request(app.getHttpServer()).post('/api/v1/auth/login').send({ email, password });
  }

  function authed(method: 'get' | 'post' | 'put' | 'patch' | 'delete', url: string, token: string) {
    return request(app.getHttpServer())[method](url).set('Authorization', `Bearer ${token}`);
  }

  /** Cadastra um policial penal via API (fluxo real de convite) na Unidade A. */
  async function createOfficer(): Promise<{ userId: number; email: string }> {
    userCounter += 1;
    const email = `users-admin-${Date.now()}-${userCounter}@test.srp.rs.gov.br`;
    const created = await authed('post', '/api/v1/users', wardenToken).send({
      name: 'Policial Admin Teste',
      email,
      role: 'PRISON_OFFICER',
      unitIds: [TEST_FIXTURE.unitAId],
    });
    expect(created.status).toBe(201);
    return { userId: (created.body as { id: number }).id, email };
  }

  /**
   * Cadastra uma SEGUNDA Chefia/Diretor, isolada de `wardenToken`/`wardenId`
   * — usada só pelo teste de auto-reset de senha (abaixo), que precisa
   * invalidar a própria sessão (jwt.strategy.ts) sem derrubar o
   * `wardenToken` compartilhado por todos os outros testes deste arquivo.
   */
  async function createWarden(): Promise<{ userId: number; email: string }> {
    userCounter += 1;
    const email = `users-admin-warden-${Date.now()}-${userCounter}@test.srp.rs.gov.br`;
    const created = await authed('post', '/api/v1/users', wardenToken).send({
      name: 'Chefia Admin Teste',
      email,
      role: 'WARDEN',
      unitIds: [TEST_FIXTURE.unitAId],
    });
    expect(created.status).toBe(201);
    return { userId: (created.body as { id: number }).id, email };
  }

  /** Define uma senha conhecida direto no banco (contorna o convite) e loga. */
  async function loginAs(userId: number, email: string) {
    const passwordHash = await app.get(PasswordHasherService).hash(TEST_FIXTURE.password);
    await app
      .get(DataSource)
      .query('UPDATE users SET password_hash = $1 WHERE id = $2', [passwordHash, userId]);
    const res = await login(email, TEST_FIXTURE.password);
    expect(res.status).toBe(201);
    return res.body as { accessToken: string; refreshToken: string };
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
    wardenId = (wardenRes.body as { user: { id: number } }).user.id;

    const supervisorRes = await login(TEST_FIXTURE.supervisorEmail, TEST_FIXTURE.password);
    supervisorToken = (supervisorRes.body as { accessToken: string }).accessToken;

    const officerRes = await login(TEST_FIXTURE.officerEmail, TEST_FIXTURE.password);
    officerToken = (officerRes.body as { accessToken: string }).accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('PATCH /api/v1/users/:id', () => {
    it('lets WARDEN edit name/badgeNumber/jobTitle/role of another user', async () => {
      const officer = await createOfficer();

      const res = await authed('patch', `/api/v1/users/${officer.userId}`, wardenToken).send({
        jobTitle: 'Agente Sênior',
        role: 'SUPERVISOR',
      });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ jobTitle: 'Agente Sênior', role: 'SUPERVISOR' });
    });

    it('rejects SUPERVISOR and PRISON_OFFICER editing a user', async () => {
      const officer = await createOfficer();

      expect(
        (
          await authed('patch', `/api/v1/users/${officer.userId}`, supervisorToken).send({
            name: 'X',
          })
        ).status,
      ).toBe(403);
      expect(
        (await authed('patch', `/api/v1/users/${officer.userId}`, officerToken).send({ name: 'X' }))
          .status,
      ).toBe(403);
    });

    it('lets WARDEN edit its own name without touching role', async () => {
      const res = await authed('patch', `/api/v1/users/${wardenId}`, wardenToken).send({
        jobTitle: 'Diretor Geral',
      });

      expect(res.status).toBe(200);
    });

    it('rejects WARDEN demoting its own role (FR-008a)', async () => {
      const res = await authed('patch', `/api/v1/users/${wardenId}`, wardenToken).send({
        role: 'SUPERVISOR',
      });

      expect(res.status).toBe(403);
    });

    it('lets WARDEN fix a mistyped e-mail (FR-003)', async () => {
      const officer = await createOfficer();
      const fixedEmail = `fixed-${Date.now()}@test.srp.rs.gov.br`;

      const res = await authed('patch', `/api/v1/users/${officer.userId}`, wardenToken).send({
        email: fixedEmail,
      });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ email: fixedEmail });
    });

    it('responds 409 when the new e-mail already belongs to another user', async () => {
      const officerA = await createOfficer();
      const officerB = await createOfficer();

      const res = await authed('patch', `/api/v1/users/${officerB.userId}`, wardenToken).send({
        email: officerA.email,
      });

      expect(res.status).toBe(409);
    });
  });

  describe('PATCH /api/v1/users/:id/reactivate', () => {
    it('reactivates a deactivated user', async () => {
      const officer = await createOfficer();
      expect(
        (await authed('patch', `/api/v1/users/${officer.userId}/deactivate`, wardenToken)).status,
      ).toBe(200);

      const res = await authed('patch', `/api/v1/users/${officer.userId}/reactivate`, wardenToken);

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ active: true });
    });

    it('rejects SUPERVISOR and PRISON_OFFICER reactivating a user', async () => {
      const officer = await createOfficer();

      expect(
        (await authed('patch', `/api/v1/users/${officer.userId}/reactivate`, supervisorToken))
          .status,
      ).toBe(403);
      expect(
        (await authed('patch', `/api/v1/users/${officer.userId}/reactivate`, officerToken)).status,
      ).toBe(403);
    });

    it('allows WARDEN to target its own account (no self-restriction on reactivate)', async () => {
      const res = await authed('patch', `/api/v1/users/${wardenId}/reactivate`, wardenToken);

      expect(res.status).toBe(200);
    });
  });

  describe('PUT /api/v1/users/:id/units (Trocar lotação)', () => {
    it('replaces the units of another user', async () => {
      const officer = await createOfficer();

      const res = await authed('put', `/api/v1/users/${officer.userId}/units`, wardenToken).send({
        unitIds: [TEST_FIXTURE.unitCId],
      });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ units: [TEST_FIXTURE.unitCId] });
    });

    it('responds 400 for an empty unitIds', async () => {
      const officer = await createOfficer();

      const res = await authed('put', `/api/v1/users/${officer.userId}/units`, wardenToken).send({
        unitIds: [],
      });

      expect(res.status).toBe(400);
    });

    // FR-004a — a Chefia/Diretor só pode lotar alguém numa unidade do próprio escopo;
    // `unitBId` é a única unidade fora do escopo do warden de teste (fixtures.ts).
    it('rejects a destination unit outside the caller own scope (403, FR-004a)', async () => {
      const officer = await createOfficer();

      const res = await authed('put', `/api/v1/users/${officer.userId}/units`, wardenToken).send({
        unitIds: [TEST_FIXTURE.unitBId],
      });

      expect(res.status).toBe(403);
    });

    it('rejects SUPERVISOR/PRISON_OFFICER and self-target for WARDEN', async () => {
      const officer = await createOfficer();

      expect(
        (
          await authed('put', `/api/v1/users/${officer.userId}/units`, supervisorToken).send({
            unitIds: [TEST_FIXTURE.unitCId],
          })
        ).status,
      ).toBe(403);
      expect(
        (
          await authed('put', `/api/v1/users/${wardenId}/units`, wardenToken).send({
            unitIds: [TEST_FIXTURE.unitCId],
          })
        ).status,
      ).toBe(403);
    });

    // Um `unitIds` com id repetido não pode fazer uma unidade válida parecer "não encontrada".
    it('tolerates a duplicate unit id in the payload', async () => {
      const officer = await createOfficer();

      const res = await authed('put', `/api/v1/users/${officer.userId}/units`, wardenToken).send({
        unitIds: [TEST_FIXTURE.unitCId, TEST_FIXTURE.unitCId],
      });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ units: [TEST_FIXTURE.unitCId] });
    });
  });

  describe('POST /api/v1/users/:id/units (Adicionar lotação)', () => {
    it('adds a unit without removing the existing ones', async () => {
      const officer = await createOfficer();

      const res = await authed('post', `/api/v1/users/${officer.userId}/units`, wardenToken).send({
        unitIds: [TEST_FIXTURE.unitCId],
      });

      expect(res.status).toBe(200);
      expect((res.body as { units: number[] }).units.sort()).toEqual(
        [TEST_FIXTURE.unitAId, TEST_FIXTURE.unitCId].sort(),
      );
    });

    // FR-004a — mesma regra de PUT /units acima.
    it('rejects a destination unit outside the caller own scope (403, FR-004a)', async () => {
      const officer = await createOfficer();

      const res = await authed('post', `/api/v1/users/${officer.userId}/units`, wardenToken).send({
        unitIds: [TEST_FIXTURE.unitBId],
      });

      expect(res.status).toBe(403);
    });

    it('rejects SUPERVISOR/PRISON_OFFICER and self-target for WARDEN', async () => {
      const officer = await createOfficer();

      expect(
        (
          await authed('post', `/api/v1/users/${officer.userId}/units`, officerToken).send({
            unitIds: [TEST_FIXTURE.unitCId],
          })
        ).status,
      ).toBe(403);
      expect(
        (
          await authed('post', `/api/v1/users/${wardenId}/units`, wardenToken).send({
            unitIds: [TEST_FIXTURE.unitCId],
          })
        ).status,
      ).toBe(403);
    });
  });

  describe('PATCH /api/v1/users/:id/reset-password', () => {
    it('completes the reset (emailDelivered: false, no SMTP in tests) and revokes existing sessions', async () => {
      const officer = await createOfficer();
      const session = await loginAs(officer.userId, officer.email);
      // `iat` do JWT só tem resolução de segundo inteiro (jwt.strategy.ts) —
      // espera cruzar pra um segundo cheio diferente antes do reset.
      await new Promise((resolve) => setTimeout(resolve, 1100));

      const res = await authed(
        'patch',
        `/api/v1/users/${officer.userId}/reset-password`,
        wardenToken,
      );

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ emailDelivered: false });

      const refreshed = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: session.refreshToken });
      expect(refreshed.status).toBe(401);

      // O access token já emitido também para de funcionar na hora, não só
      // o refresh token — senão a sessão continuaria "logada" por até 15 min
      // (FR-007, mesmo mecanismo de FR-017a em jwt.strategy.ts).
      const staleAccessRequest = await request(app.getHttpServer())
        .get('/api/v1/units')
        .set('Authorization', `Bearer ${session.accessToken}`);
      expect(staleAccessRequest.status).toBe(401);
    });

    it('rejects SUPERVISOR and PRISON_OFFICER resetting a password', async () => {
      const officer = await createOfficer();

      expect(
        (await authed('patch', `/api/v1/users/${officer.userId}/reset-password`, supervisorToken))
          .status,
      ).toBe(403);
      expect(
        (await authed('patch', `/api/v1/users/${officer.userId}/reset-password`, officerToken))
          .status,
      ).toBe(403);
    });

    it('allows WARDEN to target its own account (no self-restriction on reset-password)', async () => {
      // Chefia dedicada: resetar a própria senha invalida a própria sessão
      // na hora (jwt.strategy.ts) — faria o `wardenToken` compartilhado por
      // todo o resto deste arquivo parar de funcionar se o alvo fosse
      // `wardenId`/`wardenToken`.
      const secondWarden = await createWarden();
      const secondWardenSession = await loginAs(secondWarden.userId, secondWarden.email);

      const res = await authed(
        'patch',
        `/api/v1/users/${secondWarden.userId}/reset-password`,
        secondWardenSession.accessToken,
      );

      expect(res.status).toBe(200);
    });
  });

  describe('POST /api/v1/users/:id/resend-password-email', () => {
    it('resends the pending invite (emailDelivered: false, no SMTP in tests)', async () => {
      const officer = await createOfficer();

      const res = await authed(
        'post',
        `/api/v1/users/${officer.userId}/resend-password-email`,
        wardenToken,
      );

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ emailDelivered: false });
    });

    it('falls back to issuing a new temporary password once the initial invite was already used', async () => {
      const officer = await createOfficer();
      await app
        .get(DataSource)
        .query('UPDATE invite_tokens SET used_at = NOW() WHERE user_id = $1', [officer.userId]);

      const res = await authed(
        'post',
        `/api/v1/users/${officer.userId}/resend-password-email`,
        wardenToken,
      );

      // Sem coluna que rastreie "reset ainda pendente" (data-model.md), reenviar
      // depois do convite inicial já usado equivale a um novo reset (research.md #7).
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ emailDelivered: false });
    });

    it('responds 409 when there is no invite record at all for the user', async () => {
      const officer = await createOfficer();
      await app
        .get(DataSource)
        .query('DELETE FROM invite_tokens WHERE user_id = $1', [officer.userId]);

      const res = await authed(
        'post',
        `/api/v1/users/${officer.userId}/resend-password-email`,
        wardenToken,
      );

      expect(res.status).toBe(409);
    });

    it('rejects SUPERVISOR and PRISON_OFFICER resending the e-mail', async () => {
      const officer = await createOfficer();

      expect(
        (
          await authed(
            'post',
            `/api/v1/users/${officer.userId}/resend-password-email`,
            supervisorToken,
          )
        ).status,
      ).toBe(403);
      expect(
        (
          await authed(
            'post',
            `/api/v1/users/${officer.userId}/resend-password-email`,
            officerToken,
          )
        ).status,
      ).toBe(403);
    });
  });

  describe('PATCH /api/v1/users/:id/deactivate (FR-008a — regra nova desta fase)', () => {
    it('rejects WARDEN deactivating its own account', async () => {
      const res = await authed('patch', `/api/v1/users/${wardenId}/deactivate`, wardenToken);

      expect(res.status).toBe(403);
    });
  });

  describe('GET /api/v1/users — filtros, paginação e exclusão do próprio requisitante', () => {
    it('never lists the requesting WARDEN itself', async () => {
      await createOfficer();

      const res = await authed('get', '/api/v1/users', wardenToken);

      expect(res.status).toBe(200);
      const ids = (res.body as { data: { id: number }[] }).data.map((u) => u.id);
      expect(ids).not.toContain(wardenId);
    });

    it('filters by a free-text search matching name/email/badgeNumber', async () => {
      const officer = await createOfficer();

      const res = await authed('get', `/api/v1/users?search=${officer.email}`, wardenToken);

      expect(res.status).toBe(200);
      const body = res.body as { data: { id: number }[]; total: number };
      expect(body.total).toBe(1);
      expect(body.data[0].id).toBe(officer.userId);
    });

    it('caps the page size with `limit` and returns disjoint pages across `offset`', async () => {
      await createOfficer();
      await createOfficer();
      await createOfficer();

      const firstPage = await authed('get', '/api/v1/users?limit=1&offset=0', wardenToken);
      const secondPage = await authed('get', '/api/v1/users?limit=1&offset=1', wardenToken);

      expect(firstPage.body as { data: unknown[] }).toMatchObject({ data: expect.any(Array) });
      const firstIds = (firstPage.body as { data: { id: number }[] }).data.map((u) => u.id);
      const secondIds = (secondPage.body as { data: { id: number }[] }).data.map((u) => u.id);
      expect(firstIds).toHaveLength(1);
      expect(secondIds).toHaveLength(1);
      expect(firstIds[0]).not.toBe(secondIds[0]);
    });
  });

  describe('Máximo de 3 lotações simultâneas (regra nova, pedido do usuário)', () => {
    // As 4 unidades usadas aqui (unitA/C/D/E) precisam estar TODAS no escopo
    // do warden de teste (setup-test-db.ts) — unidades fora do escopo agora
    // respondem 403 antes mesmo de chegar na checagem do limite (FR-004a).
    it('rejects PUT /units (trocar lotação) with more than 3 units', async () => {
      const officer = await createOfficer();

      const res = await authed('put', `/api/v1/users/${officer.userId}/units`, wardenToken).send({
        unitIds: [
          TEST_FIXTURE.unitAId,
          TEST_FIXTURE.unitCId,
          TEST_FIXTURE.unitDId,
          TEST_FIXTURE.unitEId,
        ],
      });

      expect(res.status).toBe(400);
    });

    it('rejects POST /units (adicionar lotação) once the resulting total exceeds 3', async () => {
      const officer = await createOfficer(); // já começa com 1 lotação (unitA)

      // Sobe pra 2 lotações — ainda dentro do limite.
      expect(
        (
          await authed('post', `/api/v1/users/${officer.userId}/units`, wardenToken).send({
            unitIds: [TEST_FIXTURE.unitCId],
          })
        ).status,
      ).toBe(200);

      // Adicionar mais 2 (total 4) estoura o máximo de 3.
      const res = await authed('post', `/api/v1/users/${officer.userId}/units`, wardenToken).send({
        unitIds: [TEST_FIXTURE.unitDId, TEST_FIXTURE.unitEId],
      });

      expect(res.status).toBe(400);
    });
  });
});
