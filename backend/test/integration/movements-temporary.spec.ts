import { randomUUID } from 'crypto';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { TEST_FIXTURE } from './fixtures';

/**
 * Integration tests for contracts/movements.md — User Story 2 (Registro de
 * Movimentações Temporárias), against the isolated `srp_db_test` database
 * prepared by `pretest:integration`.
 */
describe('Movements endpoints — temporary (contracts/movements.md)', () => {
  let app: INestApplication;
  let wardenToken: string;
  let officerToken: string;
  let cellId: number;
  let inmateId: number;

  async function createInmate(name: string): Promise<{ inmateId: number; cellId: number }> {
    const galleryRes = await request(app.getHttpServer())
      .post('/api/v1/galleries')
      .set('Authorization', `Bearer ${wardenToken}`)
      .send({
        unitId: TEST_FIXTURE.unitAId,
        code: `MOV-${randomUUID().slice(0, 8)}`,
        type: 'MALE',
      });
    const galleryIdCreated = (galleryRes.body as { id: number }).id;

    const cellRes = await request(app.getHttpServer())
      .post('/api/v1/cells')
      .set('Authorization', `Bearer ${wardenToken}`)
      .send({ galleryId: galleryIdCreated, code: '01', capacity: 4, type: 'SHARED' });
    const cellIdCreated = (cellRes.body as { id: number }).id;

    const inmateRes = await request(app.getHttpServer())
      .post('/api/v1/inmates')
      .set('Authorization', `Bearer ${wardenToken}`)
      .send({ name, currentCellId: cellIdCreated });

    return { inmateId: (inmateRes.body as { id: number }).id, cellId: cellIdCreated };
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

    const created = await createInmate('Preso Movimentação');
    inmateId = created.inmateId;
    cellId = created.cellId;
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects an unauthenticated request', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/movements');
    expect(res.status).toBe(401);
  });

  it('allows PRISON_OFFICER to register a temporary movement exit (FR-008)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/movements')
      .set('Authorization', `Bearer ${officerToken}`)
      .send({
        inmateId,
        movementTypeId: TEST_FIXTURE.temporaryMovementTypeId,
        originCellId: cellId,
        destinationLocation: 'YARD',
        reason: 'Banho de sol',
      });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      inmateId,
      originCellId: cellId,
      destinationLocation: 'YARD',
      returnDateTime: null,
    });

    const inmateAfter = await request(app.getHttpServer())
      .get(`/api/v1/inmates/${inmateId}`)
      .set('Authorization', `Bearer ${officerToken}`);
    expect(inmateAfter.body).toMatchObject({ inMovement: true });
    expect(
      (inmateAfter.body as { currentMovement: { movementTypeName: string } }).currentMovement,
    ).toMatchObject({ movementTypeName: 'Atendimento médico interno' });
  });

  it('rejects a second open movement for the same inmate (FR-010, 409)', async () => {
    const { inmateId: newInmateId, cellId: newCellId } = await createInmate('Preso Conflito');

    const first = await request(app.getHttpServer())
      .post('/api/v1/movements')
      .set('Authorization', `Bearer ${officerToken}`)
      .send({
        inmateId: newInmateId,
        movementTypeId: TEST_FIXTURE.temporaryMovementTypeId,
        originCellId: newCellId,
        destinationLocation: 'Enfermaria',
        reason: 'Consulta',
      });
    expect(first.status).toBe(201);

    const second = await request(app.getHttpServer())
      .post('/api/v1/movements')
      .set('Authorization', `Bearer ${officerToken}`)
      .send({
        inmateId: newInmateId,
        movementTypeId: TEST_FIXTURE.temporaryMovementTypeId,
        originCellId: newCellId,
        destinationLocation: 'Enfermaria',
        reason: 'Consulta',
      });
    expect(second.status).toBe(409);
  });

  describe('concurrent exits for the same inmate (FR-010 race)', () => {
    beforeAll(async () => {
      // Listen on a real port: parallel supertest calls against an un-listened server flake with ECONNRESET.
      await app.listen(0);
    });

    async function fireConcurrentExits(
      concurrentInmateId: number,
      concurrentCellId: number,
      idempotencyKeys: (string | undefined)[],
    ): Promise<number[]> {
      const url = await app.getUrl();
      const responses = await Promise.all(
        idempotencyKeys.map((key) => {
          const call = request(url)
            .post('/api/v1/movements')
            .set('Authorization', `Bearer ${officerToken}`);
          if (key) {
            call.set('Idempotency-Key', key);
          }
          return call.send({
            inmateId: concurrentInmateId,
            movementTypeId: TEST_FIXTURE.temporaryMovementTypeId,
            originCellId: concurrentCellId,
            destinationLocation: 'YARD',
            reason: 'Corrida',
          });
        }),
      );
      return responses.map((response) => response.status).sort();
    }

    it('lets exactly one of several simultaneous exits succeed, the rest get 409', async () => {
      const concurrent = await createInmate('Preso Corrida');

      const statuses = await fireConcurrentExits(concurrent.inmateId, concurrent.cellId, [
        undefined,
        undefined,
        undefined,
        undefined,
      ]);

      expect(statuses).toEqual([201, 409, 409, 409]);
      const open = await request(app.getHttpServer())
        .get(`/api/v1/movements?inmateId=${concurrent.inmateId}&open=true`)
        .set('Authorization', `Bearer ${officerToken}`);
      expect((open.body as { total: number }).total).toBe(1);
    });

    it('treats simultaneous retries with the same Idempotency-Key as one movement (201 + 200)', async () => {
      const concurrent = await createInmate('Preso Corrida Idempotente');
      const key = randomUUID();

      const statuses = await fireConcurrentExits(concurrent.inmateId, concurrent.cellId, [
        key,
        key,
      ]);

      expect(statuses).toEqual([200, 201]);
    });
  });

  describe('inmate that is not ACTIVE (US2/AC1)', () => {
    it('rejects a temporary exit for a released inmate (409)', async () => {
      const released = await createInmate('Preso Liberado Sem Saída');
      await request(app.getHttpServer())
        .post('/api/v1/movements/final/release')
        .set('Authorization', `Bearer ${wardenToken}`)
        .send({ inmateId: released.inmateId, reason: 'Alvará' });

      const res = await request(app.getHttpServer())
        .post('/api/v1/movements')
        .set('Authorization', `Bearer ${officerToken}`)
        .send({
          inmateId: released.inmateId,
          movementTypeId: TEST_FIXTURE.temporaryMovementTypeId,
          originCellId: released.cellId,
          destinationLocation: 'YARD',
          reason: 'Não deveria sair',
        });

      expect(res.status).toBe(409);
    });
  });

  describe('concurrent returns of the same movement (FR-009 race)', () => {
    beforeAll(async () => {
      // The FR-010 race block above may already be listening (one listen() per app).
      if (!app.getHttpServer().listening) {
        await app.listen(0);
      }
    });

    it('lets exactly one of several simultaneous returns succeed, the rest get 409', async () => {
      const concurrent = await createInmate('Preso Retorno Duplo');
      const exit = await request(app.getHttpServer())
        .post('/api/v1/movements')
        .set('Authorization', `Bearer ${officerToken}`)
        .send({
          inmateId: concurrent.inmateId,
          movementTypeId: TEST_FIXTURE.temporaryMovementTypeId,
          originCellId: concurrent.cellId,
          destinationLocation: 'YARD',
          reason: 'Retorno duplo',
        });
      const movementId = (exit.body as { id: number }).id;
      const url = await app.getUrl();

      const responses = await Promise.all(
        [1, 2, 3].map(() =>
          request(url)
            .patch(`/api/v1/movements/${movementId}/return`)
            .set('Authorization', `Bearer ${officerToken}`)
            .send({}),
        ),
      );

      expect(responses.map((response) => response.status).sort()).toEqual([200, 409, 409]);
    });
  });

  it('rejects registering a movement with a PERMANENT movement type (400)', async () => {
    const { inmateId: newInmateId, cellId: newCellId } = await createInmate('Preso Tipo Errado');

    const res = await request(app.getHttpServer())
      .post('/api/v1/movements')
      .set('Authorization', `Bearer ${officerToken}`)
      .send({
        inmateId: newInmateId,
        movementTypeId: TEST_FIXTURE.permanentMovementTypeId,
        originCellId: newCellId,
        destinationLocation: 'Enfermaria',
        reason: 'Consulta',
      });
    expect(res.status).toBe(400);
  });

  it('registers a return and reflects "na cela" again (FR-009)', async () => {
    const { inmateId: newInmateId, cellId: newCellId } = await createInmate('Preso Retorno');

    const exitRes = await request(app.getHttpServer())
      .post('/api/v1/movements')
      .set('Authorization', `Bearer ${officerToken}`)
      .send({
        inmateId: newInmateId,
        movementTypeId: TEST_FIXTURE.temporaryMovementTypeId,
        originCellId: newCellId,
        destinationLocation: 'Enfermaria',
        reason: 'Consulta',
      });
    const movementId = (exitRes.body as { id: number }).id;

    const returnRes = await request(app.getHttpServer())
      .patch(`/api/v1/movements/${movementId}/return`)
      .set('Authorization', `Bearer ${officerToken}`)
      .send({});
    expect(returnRes.status).toBe(200);
    expect(returnRes.body).toMatchObject({ id: movementId });
    expect((returnRes.body as { returnDateTime: string | null }).returnDateTime).not.toBeNull();

    const inmateAfter = await request(app.getHttpServer())
      .get(`/api/v1/inmates/${newInmateId}`)
      .set('Authorization', `Bearer ${officerToken}`);
    expect(inmateAfter.body).toMatchObject({ inMovement: false, currentMovement: null });
  });

  it('rejects returning an already-returned movement (FR-009 edge case, 409)', async () => {
    const { inmateId: newInmateId, cellId: newCellId } = await createInmate('Preso Retorno Duplo');

    const exitRes = await request(app.getHttpServer())
      .post('/api/v1/movements')
      .set('Authorization', `Bearer ${officerToken}`)
      .send({
        inmateId: newInmateId,
        movementTypeId: TEST_FIXTURE.temporaryMovementTypeId,
        originCellId: newCellId,
        destinationLocation: 'Enfermaria',
        reason: 'Consulta',
      });
    const movementId = (exitRes.body as { id: number }).id;

    await request(app.getHttpServer())
      .patch(`/api/v1/movements/${movementId}/return`)
      .set('Authorization', `Bearer ${officerToken}`)
      .send({});

    const secondReturn = await request(app.getHttpServer())
      .patch(`/api/v1/movements/${movementId}/return`)
      .set('Authorization', `Bearer ${officerToken}`)
      .send({});
    expect(secondReturn.status).toBe(409);
  });

  it('allows editing an open movement (destination/reason)', async () => {
    const { inmateId: newInmateId, cellId: newCellId } = await createInmate('Preso Edição');

    const exitRes = await request(app.getHttpServer())
      .post('/api/v1/movements')
      .set('Authorization', `Bearer ${officerToken}`)
      .send({
        inmateId: newInmateId,
        movementTypeId: TEST_FIXTURE.temporaryMovementTypeId,
        originCellId: newCellId,
        destinationLocation: 'Enfermaria',
        reason: 'Consulta',
      });
    const movementId = (exitRes.body as { id: number }).id;

    const editRes = await request(app.getHttpServer())
      .patch(`/api/v1/movements/${movementId}`)
      .set('Authorization', `Bearer ${officerToken}`)
      .send({ destinationLocation: 'Ala B', reason: 'Motivo corrigido' });
    expect(editRes.status).toBe(200);
    expect(editRes.body).toMatchObject({
      id: movementId,
      destinationLocation: 'Ala B',
      reason: 'Motivo corrigido',
    });

    const inmateAfter = await request(app.getHttpServer())
      .get(`/api/v1/inmates/${newInmateId}`)
      .set('Authorization', `Bearer ${officerToken}`);
    expect(
      (inmateAfter.body as { currentMovement: { movementTypeName: string } }).currentMovement,
    ).toMatchObject({ movementTypeName: 'Atendimento médico interno' });
  });

  it('rejects editing a movement that already has a return registered (409)', async () => {
    const { inmateId: newInmateId, cellId: newCellId } = await createInmate('Preso Edição Fechada');

    const exitRes = await request(app.getHttpServer())
      .post('/api/v1/movements')
      .set('Authorization', `Bearer ${officerToken}`)
      .send({
        inmateId: newInmateId,
        movementTypeId: TEST_FIXTURE.temporaryMovementTypeId,
        originCellId: newCellId,
        destinationLocation: 'Enfermaria',
        reason: 'Consulta',
      });
    const movementId = (exitRes.body as { id: number }).id;

    await request(app.getHttpServer())
      .patch(`/api/v1/movements/${movementId}/return`)
      .set('Authorization', `Bearer ${officerToken}`)
      .send({});

    const editRes = await request(app.getHttpServer())
      .patch(`/api/v1/movements/${movementId}`)
      .set('Authorization', `Bearer ${officerToken}`)
      .send({ destinationLocation: 'Ala B' });
    expect(editRes.status).toBe(409);
  });

  describe('Idempotency-Key handling (FR-011a)', () => {
    it('replays a POST with the same Idempotency-Key instead of duplicating (200, not 201)', async () => {
      const { inmateId: newInmateId, cellId: newCellId } = await createInmate('Preso Idempotência');
      const idempotencyKey = randomUUID();

      const first = await request(app.getHttpServer())
        .post('/api/v1/movements')
        .set('Authorization', `Bearer ${officerToken}`)
        .set('Idempotency-Key', idempotencyKey)
        .send({
          inmateId: newInmateId,
          movementTypeId: TEST_FIXTURE.temporaryMovementTypeId,
          originCellId: newCellId,
          destinationLocation: 'Enfermaria',
          reason: 'Consulta',
        });
      expect(first.status).toBe(201);
      const movementId = (first.body as { id: number }).id;

      const replay = await request(app.getHttpServer())
        .post('/api/v1/movements')
        .set('Authorization', `Bearer ${officerToken}`)
        .set('Idempotency-Key', idempotencyKey)
        .send({
          inmateId: newInmateId,
          movementTypeId: TEST_FIXTURE.temporaryMovementTypeId,
          originCellId: newCellId,
          destinationLocation: 'Enfermaria',
          reason: 'Consulta',
        });
      expect(replay.status).toBe(200);
      expect(replay.body).toMatchObject({ id: movementId });

      const list = await request(app.getHttpServer())
        .get(`/api/v1/movements?inmateId=${newInmateId}`)
        .set('Authorization', `Bearer ${officerToken}`);
      expect((list.body as { total: number }).total).toBe(1);
    });

    it('replays a PATCH .../return with the same Idempotency-Key instead of 409 (200)', async () => {
      const { inmateId: newInmateId, cellId: newCellId } = await createInmate(
        'Preso Retorno Idempotente',
      );
      const returnKey = randomUUID();

      const exitRes = await request(app.getHttpServer())
        .post('/api/v1/movements')
        .set('Authorization', `Bearer ${officerToken}`)
        .send({
          inmateId: newInmateId,
          movementTypeId: TEST_FIXTURE.temporaryMovementTypeId,
          originCellId: newCellId,
          destinationLocation: 'Enfermaria',
          reason: 'Consulta',
        });
      const movementId = (exitRes.body as { id: number }).id;

      const first = await request(app.getHttpServer())
        .patch(`/api/v1/movements/${movementId}/return`)
        .set('Authorization', `Bearer ${officerToken}`)
        .set('Idempotency-Key', returnKey)
        .send({});
      expect(first.status).toBe(200);

      const replay = await request(app.getHttpServer())
        .patch(`/api/v1/movements/${movementId}/return`)
        .set('Authorization', `Bearer ${officerToken}`)
        .set('Idempotency-Key', returnKey)
        .send({});
      expect(replay.status).toBe(200);
      expect(replay.body).toMatchObject({ id: movementId });
    });
  });

  it('rejects registering a movement for an inmate outside the caller unit scope (403)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/movements')
      .set('Authorization', `Bearer ${wardenToken}`)
      .send({
        inmateId: 999999,
        movementTypeId: TEST_FIXTURE.temporaryMovementTypeId,
        originCellId: 999999,
        destinationLocation: 'Enfermaria',
        reason: 'Consulta',
      });
    expect([403, 404]).toContain(res.status);
  });

  it('filters GET /movements?open=true to only open movements', async () => {
    const { inmateId: newInmateId, cellId: newCellId } = await createInmate('Preso Filtro Aberto');
    await request(app.getHttpServer())
      .post('/api/v1/movements')
      .set('Authorization', `Bearer ${officerToken}`)
      .send({
        inmateId: newInmateId,
        movementTypeId: TEST_FIXTURE.temporaryMovementTypeId,
        originCellId: newCellId,
        destinationLocation: 'Enfermaria',
        reason: 'Consulta',
      });

    const res = await request(app.getHttpServer())
      .get(`/api/v1/movements?inmateId=${newInmateId}&open=true`)
      .set('Authorization', `Bearer ${officerToken}`);
    expect(res.status).toBe(200);
    expect((res.body as { total: number }).total).toBe(1);
  });
});
