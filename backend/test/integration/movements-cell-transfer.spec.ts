import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { TEST_FIXTURE } from './fixtures';

/**
 * Integration tests for contracts/movements.md — troca/permuta de cela e
 * galeria (research.md #35, FR-015–FR-015c), against the isolated
 * `srp_db_test` database prepared by `pretest:integration`.
 */
describe('Movements endpoints — troca/permuta de cela e galeria (contracts/movements.md)', () => {
  let app: INestApplication;
  let wardenToken: string;
  let officerToken: string;

  async function createGallery(): Promise<number> {
    const res = await request(app.getHttpServer())
      .post('/api/v1/galleries')
      .set('Authorization', `Bearer ${wardenToken}`)
      .send({
        unitId: TEST_FIXTURE.unitAId,
        code: `CT-${Date.now()}-${Math.random()}`,
        type: 'MALE',
      });
    return (res.body as { id: number }).id;
  }

  async function createCell(galleryId: number, code: string, capacity: number): Promise<number> {
    const res = await request(app.getHttpServer())
      .post('/api/v1/cells')
      .set('Authorization', `Bearer ${wardenToken}`)
      .send({ galleryId, code, capacity, type: 'SHARED' });
    return (res.body as { id: number }).id;
  }

  async function createInmate(name: string, cellId: number): Promise<number> {
    const res = await request(app.getHttpServer())
      .post('/api/v1/inmates')
      .set('Authorization', `Bearer ${wardenToken}`)
      .send({ name, currentCellId: cellId });
    return (res.body as { id: number }).id;
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

  describe('POST /movements/cell-change (FR-015) — qualquer perfil', () => {
    it('moves the inmate to a same-gallery cell with vacancy, freeing the origin', async () => {
      const galleryId = await createGallery();
      const originCellId = await createCell(galleryId, '01', 2);
      const destCellId = await createCell(galleryId, '02', 2);
      const inmateId = await createInmate('Preso Troca', originCellId);

      const res = await request(app.getHttpServer())
        .post('/api/v1/movements/cell-change')
        .set('Authorization', `Bearer ${officerToken}`)
        .send({ inmateId, destinationCellId: destCellId, reason: 'Reorganização' });
      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ inmateId, destinationCellId: destCellId });

      const inmateAfter = await request(app.getHttpServer())
        .get(`/api/v1/inmates/${inmateId}`)
        .set('Authorization', `Bearer ${wardenToken}`);
      expect(inmateAfter.body).toMatchObject({ status: 'ACTIVE', currentCellId: destCellId });
      expect(await cellOccupancy(originCellId, galleryId)).toBe(0);
      expect(await cellOccupancy(destCellId, galleryId)).toBe(1);
    });

    it('rejects when the destination cell is already at capacity (edge case, 400)', async () => {
      const galleryId = await createGallery();
      const originCellId = await createCell(galleryId, '01', 2);
      const fullCellId = await createCell(galleryId, '02', 1);
      const inmateId = await createInmate('Preso Sem Vaga', originCellId);
      await createInmate('Ocupante', fullCellId);

      const res = await request(app.getHttpServer())
        .post('/api/v1/movements/cell-change')
        .set('Authorization', `Bearer ${officerToken}`)
        .send({ inmateId, destinationCellId: fullCellId, reason: 'Tentativa' });
      expect(res.status).toBe(400);
    });

    it('rejects when the destination cell is in a different gallery (400)', async () => {
      const galleryA = await createGallery();
      const galleryB = await createGallery();
      const originCellId = await createCell(galleryA, '01', 2);
      const otherGalleryCellId = await createCell(galleryB, '01', 2);
      const inmateId = await createInmate('Preso Galeria Errada', originCellId);

      const res = await request(app.getHttpServer())
        .post('/api/v1/movements/cell-change')
        .set('Authorization', `Bearer ${officerToken}`)
        .send({ inmateId, destinationCellId: otherGalleryCellId, reason: 'Tentativa' });
      expect(res.status).toBe(400);
    });
  });

  describe('POST /movements/cell-swap (FR-015a) — qualquer perfil', () => {
    it('swaps two inmates between same-gallery cells simultaneously, no vacancy required', async () => {
      const galleryId = await createGallery();
      const cellAId = await createCell(galleryId, '01', 1);
      const cellBId = await createCell(galleryId, '02', 1);
      const inmateAId = await createInmate('Preso A', cellAId);
      const inmateBId = await createInmate('Preso B', cellBId);

      const res = await request(app.getHttpServer())
        .post('/api/v1/movements/cell-swap')
        .set('Authorization', `Bearer ${officerToken}`)
        .send({
          inmateId: inmateAId,
          destinationCellId: cellBId,
          destinationInmateId: inmateBId,
          reason: 'Permuta a pedido',
        });
      expect(res.status).toBe(201);

      const [movementA, movementB] = res.body as {
        id: number;
        inmateId: number;
        pairedMovementId: number;
      }[];
      expect(movementA).toMatchObject({ inmateId: inmateAId, pairedMovementId: movementB.id });
      expect(movementB).toMatchObject({ inmateId: inmateBId, pairedMovementId: movementA.id });

      const inmateAAfter = await request(app.getHttpServer())
        .get(`/api/v1/inmates/${inmateAId}`)
        .set('Authorization', `Bearer ${wardenToken}`);
      const inmateBAfter = await request(app.getHttpServer())
        .get(`/api/v1/inmates/${inmateBId}`)
        .set('Authorization', `Bearer ${wardenToken}`);
      expect(inmateAAfter.body).toMatchObject({ status: 'ACTIVE', currentCellId: cellBId });
      expect(inmateBAfter.body).toMatchObject({ status: 'ACTIVE', currentCellId: cellAId });
      expect(await cellOccupancy(cellAId, galleryId)).toBe(1);
      expect(await cellOccupancy(cellBId, galleryId)).toBe(1);
    });

    it('swaps with the specific chosen occupant when the destination cell has multiple active inmates (correctness)', async () => {
      // Regressão do bug relatado pelo usuário: cela compartilhada com 2+
      // presos ativos — a permuta MUST trocar com quem foi escolhido
      // (`destinationInmateId`), nunca "qualquer um" da cela.
      const galleryId = await createGallery();
      const cellAId = await createCell(galleryId, '01', 1);
      const sharedCellId = await createCell(galleryId, '02', 2);
      const inmateAId = await createInmate('Preso A Permuta Múltipla', cellAId);
      const inmateB1Id = await createInmate('Preso B1 Não Escolhido', sharedCellId);
      const inmateB2Id = await createInmate('Preso B2 Escolhido', sharedCellId);

      const res = await request(app.getHttpServer())
        .post('/api/v1/movements/cell-swap')
        .set('Authorization', `Bearer ${officerToken}`)
        .send({
          inmateId: inmateAId,
          destinationCellId: sharedCellId,
          destinationInmateId: inmateB2Id,
          reason: 'Permuta específica',
        });
      expect(res.status).toBe(201);

      const inmateAAfter = await request(app.getHttpServer())
        .get(`/api/v1/inmates/${inmateAId}`)
        .set('Authorization', `Bearer ${wardenToken}`);
      const inmateB1After = await request(app.getHttpServer())
        .get(`/api/v1/inmates/${inmateB1Id}`)
        .set('Authorization', `Bearer ${wardenToken}`);
      const inmateB2After = await request(app.getHttpServer())
        .get(`/api/v1/inmates/${inmateB2Id}`)
        .set('Authorization', `Bearer ${wardenToken}`);
      expect(inmateAAfter.body).toMatchObject({ currentCellId: sharedCellId });
      expect(inmateB2After.body).toMatchObject({ currentCellId: cellAId });
      expect(inmateB1After.body).toMatchObject({ currentCellId: sharedCellId });
    });

    it('rejects when destinationInmateId is missing (400)', async () => {
      const galleryId = await createGallery();
      const cellAId = await createCell(galleryId, '01', 1);
      const cellBId = await createCell(galleryId, '02', 1);
      const inmateAId = await createInmate('Preso Sem Destino', cellAId);
      await createInmate('Preso B', cellBId);

      const res = await request(app.getHttpServer())
        .post('/api/v1/movements/cell-swap')
        .set('Authorization', `Bearer ${officerToken}`)
        .send({ inmateId: inmateAId, destinationCellId: cellBId, reason: 'Tentativa' });
      expect(res.status).toBe(400);
    });

    it('rejects when destinationInmateId is not currently in destinationCellId (race condition, 409)', async () => {
      const galleryId = await createGallery();
      const cellAId = await createCell(galleryId, '01', 1);
      const emptyCellId = await createCell(galleryId, '02', 1);
      const elsewhereCellId = await createCell(galleryId, '03', 1);
      const inmateAId = await createInmate('Preso Sozinho', cellAId);
      const staleInmateId = await createInmate('Preso Em Outro Lugar', elsewhereCellId);

      const res = await request(app.getHttpServer())
        .post('/api/v1/movements/cell-swap')
        .set('Authorization', `Bearer ${officerToken}`)
        .send({
          inmateId: inmateAId,
          destinationCellId: emptyCellId,
          destinationInmateId: staleInmateId,
          reason: 'Tentativa',
        });
      expect(res.status).toBe(409);
    });
  });

  describe('RBAC — troca/permuta de galeria restritas a SUPERVISOR/WARDEN', () => {
    it('rejects PRISON_OFFICER on gallery-change and gallery-swap (403)', async () => {
      const galleryA = await createGallery();
      const galleryB = await createGallery();
      const cellAId = await createCell(galleryA, '01', 2);
      const cellBId = await createCell(galleryB, '01', 2);
      const inmateId = await createInmate('Preso Restrito', cellAId);

      const changeRes = await request(app.getHttpServer())
        .post('/api/v1/movements/gallery-change')
        .set('Authorization', `Bearer ${officerToken}`)
        .send({ inmateId, destinationCellId: cellBId, reason: 'Tentativa' });
      expect(changeRes.status).toBe(403);

      const swapRes = await request(app.getHttpServer())
        .post('/api/v1/movements/gallery-swap')
        .set('Authorization', `Bearer ${officerToken}`)
        .send({ inmateId, destinationCellId: cellBId, reason: 'Tentativa' });
      expect(swapRes.status).toBe(403);
    });
  });

  describe('POST /movements/gallery-change (FR-015b) — SUPERVISOR/WARDEN', () => {
    it('moves the inmate to a different-gallery cell with vacancy', async () => {
      const galleryA = await createGallery();
      const galleryB = await createGallery();
      const originCellId = await createCell(galleryA, '01', 2);
      const destCellId = await createCell(galleryB, '01', 2);
      const inmateId = await createInmate('Preso Troca Galeria', originCellId);

      const res = await request(app.getHttpServer())
        .post('/api/v1/movements/gallery-change')
        .set('Authorization', `Bearer ${wardenToken}`)
        .send({ inmateId, destinationCellId: destCellId, reason: 'Reorganização entre galerias' });
      expect(res.status).toBe(201);

      const inmateAfter = await request(app.getHttpServer())
        .get(`/api/v1/inmates/${inmateId}`)
        .set('Authorization', `Bearer ${wardenToken}`);
      expect(inmateAfter.body).toMatchObject({ status: 'ACTIVE', currentCellId: destCellId });
    });

    it('rejects when the destination cell is in the same gallery (400)', async () => {
      const galleryId = await createGallery();
      const originCellId = await createCell(galleryId, '01', 2);
      const sameGalleryCellId = await createCell(galleryId, '02', 2);
      const inmateId = await createInmate('Preso Mesma Galeria', originCellId);

      const res = await request(app.getHttpServer())
        .post('/api/v1/movements/gallery-change')
        .set('Authorization', `Bearer ${wardenToken}`)
        .send({ inmateId, destinationCellId: sameGalleryCellId, reason: 'Tentativa' });
      expect(res.status).toBe(400);
    });
  });

  describe('Bloqueio com movimentação temporária em aberto', () => {
    async function openTemporaryMovement(inmateId: number, cellId: number): Promise<void> {
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
    }

    it('rejects cell-change when the inmate has an open TEMPORARY movement (409)', async () => {
      const galleryId = await createGallery();
      const originCellId = await createCell(galleryId, '01', 2);
      const destCellId = await createCell(galleryId, '02', 2);
      const inmateId = await createInmate('Preso Fora Da Cela', originCellId);
      await openTemporaryMovement(inmateId, originCellId);

      const res = await request(app.getHttpServer())
        .post('/api/v1/movements/cell-change')
        .set('Authorization', `Bearer ${officerToken}`)
        .send({ inmateId, destinationCellId: destCellId, reason: 'Tentativa' });
      expect(res.status).toBe(409);
    });

    it('rejects cell-swap when the OTHER inmate (destination occupant) has an open TEMPORARY movement (409)', async () => {
      const galleryId = await createGallery();
      const cellAId = await createCell(galleryId, '01', 1);
      const cellBId = await createCell(galleryId, '02', 1);
      const inmateAId = await createInmate('Preso A Disponível', cellAId);
      const inmateBId = await createInmate('Preso B Fora Da Cela', cellBId);
      await openTemporaryMovement(inmateBId, cellBId);

      const res = await request(app.getHttpServer())
        .post('/api/v1/movements/cell-swap')
        .set('Authorization', `Bearer ${officerToken}`)
        .send({
          inmateId: inmateAId,
          destinationCellId: cellBId,
          destinationInmateId: inmateBId,
          reason: 'Tentativa',
        });
      expect(res.status).toBe(409);
    });
  });

  describe('POST /movements/gallery-swap (FR-015c) — SUPERVISOR/WARDEN', () => {
    it('swaps two inmates between different-gallery cells simultaneously', async () => {
      const galleryA = await createGallery();
      const galleryB = await createGallery();
      const cellAId = await createCell(galleryA, '01', 1);
      const cellBId = await createCell(galleryB, '01', 1);
      const inmateAId = await createInmate('Preso Galeria A', cellAId);
      const inmateBId = await createInmate('Preso Galeria B', cellBId);

      const res = await request(app.getHttpServer())
        .post('/api/v1/movements/gallery-swap')
        .set('Authorization', `Bearer ${wardenToken}`)
        .send({
          inmateId: inmateAId,
          destinationCellId: cellBId,
          destinationInmateId: inmateBId,
          reason: 'Permuta entre galerias',
        });
      expect(res.status).toBe(201);

      const inmateAAfter = await request(app.getHttpServer())
        .get(`/api/v1/inmates/${inmateAId}`)
        .set('Authorization', `Bearer ${wardenToken}`);
      const inmateBAfter = await request(app.getHttpServer())
        .get(`/api/v1/inmates/${inmateBId}`)
        .set('Authorization', `Bearer ${wardenToken}`);
      expect(inmateAAfter.body).toMatchObject({ currentCellId: cellBId });
      expect(inmateBAfter.body).toMatchObject({ currentCellId: cellAId });
    });
  });
});
