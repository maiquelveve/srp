import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { TEST_FIXTURE } from './fixtures';

/**
 * Integration tests for contracts/movements.md — User Story 3 (Situações
 * Definitivas), against the isolated `srp_db_test` database prepared by
 * `pretest:integration`. Also covers `GET /inmates/:id/location-history`
 * (FR-016), part of the same contract.
 */
describe('Movements endpoints — final/situações definitivas (contracts/movements.md)', () => {
  let app: INestApplication;
  let wardenToken: string;
  let officerToken: string;

  async function createInmate(
    name: string,
  ): Promise<{ inmateId: number; cellId: number; galleryId: number }> {
    const galleryRes = await request(app.getHttpServer())
      .post('/api/v1/galleries')
      .set('Authorization', `Bearer ${wardenToken}`)
      .send({
        unitId: TEST_FIXTURE.unitAId,
        code: `FIN-${Date.now()}-${Math.random()}`,
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

    return { inmateId: (inmateRes.body as { id: number }).id, cellId, galleryId };
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

  describe('RBAC — WARDEN only (contracts/movements.md)', () => {
    it('rejects PRISON_OFFICER on every final/* endpoint (403)', async () => {
      const { inmateId } = await createInmate('Preso RBAC');

      const endpoints = [
        { path: 'release', body: { inmateId, reason: 'Alvará 1' } },
        { path: 'ankle-monitor', body: { inmateId, reason: 'Dispositivo 1' } },
        { path: 'transfer', body: { inmateId, reason: 'Escolta PM, Penitenciária Vizinha' } },
      ];
      for (const endpoint of endpoints) {
        const res = await request(app.getHttpServer())
          .post(`/api/v1/movements/final/${endpoint.path}`)
          .set('Authorization', `Bearer ${officerToken}`)
          .send(endpoint.body);
        expect(res.status).toBe(403);
      }
    });
  });

  it('registers liberdade (FR-012): status RELEASED, cela de origem liberada', async () => {
    const { inmateId, cellId, galleryId } = await createInmate('Preso Liberdade');
    expect(await cellOccupancy(cellId, galleryId)).toBe(1);

    const res = await request(app.getHttpServer())
      .post('/api/v1/movements/final/release')
      .set('Authorization', `Bearer ${wardenToken}`)
      .send({ inmateId, reason: 'Alvará nº 123, Vara Criminal, Agente João' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ inmateId, destinationLocation: 'Liberdade' });

    const inmateAfter = await request(app.getHttpServer())
      .get(`/api/v1/inmates/${inmateId}`)
      .set('Authorization', `Bearer ${wardenToken}`);
    expect(inmateAfter.body).toMatchObject({ status: 'RELEASED' });

    expect(await cellOccupancy(cellId, galleryId)).toBe(0);
  });

  it('registers tornozeleira (FR-013): status ANKLE_MONITOR', async () => {
    const { inmateId, cellId, galleryId } = await createInmate('Preso Tornozeleira');

    const res = await request(app.getHttpServer())
      .post('/api/v1/movements/final/ankle-monitor')
      .set('Authorization', `Bearer ${wardenToken}`)
      .send({
        inmateId,
        reason: 'Dispositivo nº 456, Empresa X',
        notes: 'Não pode sair do município',
      });
    expect(res.status).toBe(201);

    const inmateAfter = await request(app.getHttpServer())
      .get(`/api/v1/inmates/${inmateId}`)
      .set('Authorization', `Bearer ${wardenToken}`);
    expect(inmateAfter.body).toMatchObject({ status: 'ANKLE_MONITOR' });
    expect(await cellOccupancy(cellId, galleryId)).toBe(0);
  });

  it('registers transferência (FR-014): status TRANSFERRED', async () => {
    const { inmateId, cellId, galleryId } = await createInmate('Preso Transferência');

    const res = await request(app.getHttpServer())
      .post('/api/v1/movements/final/transfer')
      .set('Authorization', `Bearer ${wardenToken}`)
      .send({ inmateId, reason: 'Escolta PM, Penitenciária Vizinha' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ destinationLocation: 'Transferência' });

    const inmateAfter = await request(app.getHttpServer())
      .get(`/api/v1/inmates/${inmateId}`)
      .set('Authorization', `Bearer ${wardenToken}`);
    expect(inmateAfter.body).toMatchObject({ status: 'TRANSFERRED' });
    expect(await cellOccupancy(cellId, galleryId)).toBe(0);
  });

  describe('Bloqueio com movimentação temporária em aberto', () => {
    it('rejects final/release when the inmate has an open TEMPORARY movement (409)', async () => {
      const { inmateId, cellId } = await createInmate('Preso Em Atendimento');

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

      const res = await request(app.getHttpServer())
        .post('/api/v1/movements/final/release')
        .set('Authorization', `Bearer ${wardenToken}`)
        .send({ inmateId, reason: 'Tentativa' });
      expect(res.status).toBe(409);
    });
  });

  // Troca/permuta de cela/galeria (FR-015–FR-015c) têm sua própria suíte —
  // backend/test/integration/movements-cell-transfer.spec.ts (research.md #35).

  describe('GET /movements/definitive-situations (FR-016a)', () => {
    const runTag = Date.now().toString().slice(-8);

    function list(token: string, query: string) {
      return request(app.getHttpServer())
        .get(`/api/v1/movements/definitive-situations?${query}`)
        .set('Authorization', `Bearer ${token}`);
    }

    function situationRows(res: request.Response) {
      return (
        res.body as {
          data: {
            inmateId: number;
            situation: string;
            inmateName: string;
            registrationId: string | null;
          }[];
          total: number;
        }
      ).data;
    }

    function post(path: string, body: Record<string, unknown>) {
      return request(app.getHttpServer())
        .post(path)
        .set('Authorization', `Bearer ${wardenToken}`)
        .send(body);
    }

    it('rejects PRISON_OFFICER and SUPERVISOR (403)', async () => {
      const supervisorLogin = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: TEST_FIXTURE.supervisorEmail, password: TEST_FIXTURE.password });
      const supervisorToken = (supervisorLogin.body as { accessToken: string }).accessToken;

      expect((await list(officerToken, '')).status).toBe(403);
      expect((await list(supervisorToken, '')).status).toBe(403);
    });

    it('lists a released inmate with situation, reason and who registered it', async () => {
      const { inmateId } = await createInmate(`Lista ${runTag} Alfa`);
      await post('/api/v1/movements/final/release', { inmateId, reason: 'Alvará da listagem' });

      const res = await list(wardenToken, `name=Lista ${runTag} Alfa`);

      expect(res.status).toBe(200);
      const rows = res.body as {
        data: { inmateId: number; situation: string; reason: string; registeredByName: string }[];
        total: number;
      };
      expect(rows.total).toBe(1);
      expect(rows.data[0]).toMatchObject({
        inmateId,
        situation: 'Liberdade',
        reason: 'Alvará da listagem',
      });
      expect(rows.data[0].registeredByName).toBeTruthy();
    });

    it('filters by part of the name ignoring case, and by registration code', async () => {
      const { cellId } = await createInmate(`Base ${runTag}`);
      const code = `MAT-${runTag}`;
      const created = await post('/api/v1/inmates', {
        name: `Fulano ${runTag} Silva`,
        currentCellId: cellId,
        registrationId: code,
      });
      const inmateId = (created.body as { id: number }).id;
      await post('/api/v1/movements/final/release', { inmateId, reason: 'Filtro' });

      const byName = await list(wardenToken, `name=${`fulano ${runTag}`.toUpperCase()}`);
      const byPartialName = await list(wardenToken, `name=${runTag} sil`);
      const byCode = await list(wardenToken, `registrationId=${code}`);
      const wildcard = await list(wardenToken, 'name=%25');

      for (const res of [byName, byPartialName, byCode]) {
        expect(situationRows(res).map((row) => row.inmateId)).toEqual([inmateId]);
      }
      expect(situationRows(byCode)[0].registrationId).toBe(code);
      // `%` digitado vale literalmente, não como curinga.
      expect((wildcard.body as { total: number }).total).toBe(0);
    });

    it('limits by registration date: default 6 months, then 1 year, 5 years and all', async () => {
      const recent = await createInmate(`Periodo ${runTag} Recente`);
      const oneYearAgo = await createInmate(`Periodo ${runTag} Um Ano`);
      const threeYearsAgo = await createInmate(`Periodo ${runTag} Tres Anos`);
      const monthsAgo = (months: number) => {
        const date = new Date();
        date.setMonth(date.getMonth() - months);
        return date.toISOString();
      };
      await post('/api/v1/movements/final/release', { inmateId: recent.inmateId, reason: 'a' });
      await post('/api/v1/movements/final/release', {
        inmateId: oneYearAgo.inmateId,
        reason: 'b',
        exitDateTime: monthsAgo(9),
      });
      await post('/api/v1/movements/final/release', {
        inmateId: threeYearsAgo.inmateId,
        reason: 'c',
        exitDateTime: monthsAgo(36),
      });
      const idsFor = async (period: string) =>
        situationRows(await list(wardenToken, `name=Periodo ${runTag}&period=${period}`))
          .map((row) => row.inmateId)
          .sort((a, b) => a - b);
      const sorted = (...ids: number[]) => ids.sort((a, b) => a - b);

      const defaultPeriod = situationRows(await list(wardenToken, `name=Periodo ${runTag}`));

      expect(defaultPeriod.map((row) => row.inmateId)).toEqual([recent.inmateId]);
      expect(await idsFor('6m')).toEqual([recent.inmateId]);
      expect(await idsFor('1y')).toEqual(sorted(recent.inmateId, oneYearAgo.inmateId));
      expect(await idsFor('5y')).toEqual(
        sorted(recent.inmateId, oneYearAgo.inmateId, threeYearsAgo.inmateId),
      );
      expect(await idsFor('all')).toEqual(
        sorted(recent.inmateId, oneYearAgo.inmateId, threeYearsAgo.inmateId),
      );
    });

    it('paginates on the server and keeps the total, newest first', async () => {
      const ids: number[] = [];
      for (const suffix of ['A', 'B', 'C']) {
        const { inmateId } = await createInmate(`Pagina ${runTag} ${suffix}`);
        ids.push(inmateId);
        await post('/api/v1/movements/final/release', { inmateId, reason: `Página ${suffix}` });
      }

      const first = await list(wardenToken, `name=Pagina ${runTag}&limit=2&offset=0`);
      const second = await list(wardenToken, `name=Pagina ${runTag}&limit=2&offset=2`);

      expect(situationRows(first)).toHaveLength(2);
      expect(situationRows(second)).toHaveLength(1);
      expect((first.body as { total: number }).total).toBe(3);
      expect((second.body as { total: number }).total).toBe(3);
      expect(
        [...situationRows(first), ...situationRows(second)].map((row) => row.inmateId),
      ).toEqual([...ids].reverse());
    });

    it('shows only the current situation and drops the inmate once reverted', async () => {
      const { inmateId, cellId } = await createInmate(`Vigente ${runTag}`);
      await post('/api/v1/movements/final/release', { inmateId, reason: 'Liberdade errada' });
      await post('/api/v1/movements/final/reversal', {
        inmateId,
        destinationCellId: cellId,
        reason: 'Revertida',
      });
      const afterReversal = await list(wardenToken, `name=Vigente ${runTag}`);
      await post('/api/v1/movements/final/ankle-monitor', {
        inmateId,
        reason: 'Agora tornozeleira',
      });
      const afterAnkleMonitor = await list(wardenToken, `name=Vigente ${runTag}`);
      await post('/api/v1/movements/final/reversal', {
        inmateId,
        destinationCellId: cellId,
        reason: 'Revertida de novo',
      });
      const afterSecondReversal = await list(wardenToken, `name=Vigente ${runTag}`);

      expect(situationRows(afterReversal)).toHaveLength(0);
      expect(situationRows(afterAnkleMonitor)).toHaveLength(1);
      expect(situationRows(afterAnkleMonitor)[0].situation).toBe('Tornozeleira eletrônica');
      expect(situationRows(afterSecondReversal)).toHaveLength(0);
    });

    it('rejects a unit outside the caller scope (403) and an invalid period (400)', async () => {
      expect((await list(wardenToken, 'unitId=999999')).status).toBe(403);
      expect((await list(wardenToken, 'period=2y')).status).toBe(400);
    });
  });

  describe('audit of the movement record (FR-026, SC-002)', () => {
    async function movementAudit(movementId: number) {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/audit?table=movements&recordId=${movementId}`)
        .set('Authorization', `Bearer ${wardenToken}`);
      return (res.body as { data: { action: string; newData: Record<string, unknown> | null }[] })
        .data;
    }

    it('writes a movements INSERT entry, with the reason, for a liberdade', async () => {
      const { inmateId } = await createInmate('Preso Auditoria Liberdade');

      const res = await request(app.getHttpServer())
        .post('/api/v1/movements/final/release')
        .set('Authorization', `Bearer ${wardenToken}`)
        .send({ inmateId, reason: 'Alvará nº 555 para auditoria' });

      const entries = await movementAudit((res.body as { id: number }).id);
      expect(entries).toHaveLength(1);
      expect(entries[0]).toMatchObject({
        action: 'INSERT',
        newData: { inmateId, reason: 'Alvará nº 555 para auditoria' },
      });
    });

    it('writes one movements INSERT entry per inmate of a permuta', async () => {
      const first = await createInmate('Preso Auditoria Permuta A');
      const secondCellRes = await request(app.getHttpServer())
        .post('/api/v1/cells')
        .set('Authorization', `Bearer ${wardenToken}`)
        .send({ galleryId: first.galleryId, code: '05', capacity: 2, type: 'SHARED' });
      const secondCellId = (secondCellRes.body as { id: number }).id;
      const secondInmateRes = await request(app.getHttpServer())
        .post('/api/v1/inmates')
        .set('Authorization', `Bearer ${wardenToken}`)
        .send({ name: 'Preso Auditoria Permuta B', currentCellId: secondCellId });
      const secondInmateId = (secondInmateRes.body as { id: number }).id;

      const swap = await request(app.getHttpServer())
        .post('/api/v1/movements/cell-swap')
        .set('Authorization', `Bearer ${wardenToken}`)
        .send({
          inmateId: first.inmateId,
          destinationCellId: secondCellId,
          destinationInmateId: secondInmateId,
          reason: 'Permuta auditada',
        });

      expect(swap.status).toBe(201);
      const movements = swap.body as { id: number }[];
      expect(movements).toHaveLength(2);
      for (const movement of movements) {
        const entries = await movementAudit(movement.id);
        expect(entries).toHaveLength(1);
        expect(entries[0].action).toBe('INSERT');
      }
    });
  });

  describe('inmate that is not ACTIVE (US3, Constituição IV)', () => {
    it('rejects a second liberdade, a tornozeleira and a transferência for a released inmate (409)', async () => {
      const { inmateId } = await createInmate('Preso Já Liberado');
      const first = await request(app.getHttpServer())
        .post('/api/v1/movements/final/release')
        .set('Authorization', `Bearer ${wardenToken}`)
        .send({ inmateId, reason: 'Alvará 1' });
      expect(first.status).toBe(201);

      for (const path of ['release', 'ankle-monitor', 'transfer']) {
        const res = await request(app.getHttpServer())
          .post(`/api/v1/movements/final/${path}`)
          .set('Authorization', `Bearer ${wardenToken}`)
          .send({ inmateId, reason: 'Repetido' });
        expect(res.status).toBe(409);
        // A mensagem chega ao usuário: em português, sem enum em inglês e sem travessão longo.
        const message = (res.body as { message: string }).message;
        expect(message).toContain('em liberdade');
        expect(message).not.toMatch(/RELEASED|—/);
      }
    });

    it('rejects a cell-change for a released inmate (409) and keeps him RELEASED', async () => {
      const { inmateId, galleryId } = await createInmate('Preso Liberado Sem Troca');
      const otherCell = await request(app.getHttpServer())
        .post('/api/v1/cells')
        .set('Authorization', `Bearer ${wardenToken}`)
        .send({ galleryId, code: '09', capacity: 2, type: 'SHARED' });
      await request(app.getHttpServer())
        .post('/api/v1/movements/final/release')
        .set('Authorization', `Bearer ${wardenToken}`)
        .send({ inmateId, reason: 'Alvará' });

      const res = await request(app.getHttpServer())
        .post('/api/v1/movements/cell-change')
        .set('Authorization', `Bearer ${wardenToken}`)
        .send({
          inmateId,
          destinationCellId: (otherCell.body as { id: number }).id,
          reason: 'Não deveria trocar',
        });

      expect(res.status).toBe(409);
      const after = await request(app.getHttpServer())
        .get(`/api/v1/inmates/${inmateId}`)
        .set('Authorization', `Bearer ${wardenToken}`);
      expect(after.body).toMatchObject({ status: 'RELEASED' });
    });
  });

  describe('POST /movements/final/reversal (FR-016a)', () => {
    async function createCell(galleryId: number, code: string, capacity: number): Promise<number> {
      const res = await request(app.getHttpServer())
        .post('/api/v1/cells')
        .set('Authorization', `Bearer ${wardenToken}`)
        .send({ galleryId, code, capacity, type: 'SHARED' });
      return (res.body as { id: number }).id;
    }

    function reverse(token: string, body: Record<string, unknown>) {
      return request(app.getHttpServer())
        .post('/api/v1/movements/final/reversal')
        .set('Authorization', `Bearer ${token}`)
        .send(body);
    }

    function release(inmateId: number) {
      return request(app.getHttpServer())
        .post('/api/v1/movements/final/release')
        .set('Authorization', `Bearer ${wardenToken}`)
        .send({ inmateId, reason: 'Alvará registrado por engano' });
    }

    it('brings a released inmate back to ACTIVE in the chosen cell, keeping the original record', async () => {
      const { inmateId, galleryId } = await createInmate('Preso Reversão');
      const newCellId = await createCell(galleryId, '02', 2);
      const releaseRes = await release(inmateId);
      expect(releaseRes.status).toBe(201);
      const releaseMovementId = (releaseRes.body as { id: number }).id;

      const res = await reverse(wardenToken, {
        inmateId,
        destinationCellId: newCellId,
        reason: 'Liberdade lançada por engano',
      });

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ inmateId, destinationLocation: 'Cela 02' });
      const inmateAfter = await request(app.getHttpServer())
        .get(`/api/v1/inmates/${inmateId}`)
        .set('Authorization', `Bearer ${wardenToken}`);
      expect(inmateAfter.body).toMatchObject({ status: 'ACTIVE' });
      expect(await cellOccupancy(newCellId, galleryId)).toBe(1);

      // O registro original continua no histórico; a reversão é uma movimentação nova.
      const movements = await request(app.getHttpServer())
        .get(`/api/v1/movements?inmateId=${inmateId}`)
        .set('Authorization', `Bearer ${wardenToken}`);
      const ids = (movements.body as { data: { id: number }[] }).data.map((item) => item.id);
      expect(ids).toContain(releaseMovementId);
      expect(ids).toContain((res.body as { id: number }).id);

      const history = await request(app.getHttpServer())
        .get(`/api/v1/inmates/${inmateId}/location-history`)
        .set('Authorization', `Bearer ${wardenToken}`);
      const entries = history.body as { cellId: number; exitDate: string | null }[];
      expect(entries).toHaveLength(2);
      expect(entries[0].exitDate).not.toBeNull();
      expect(entries[1]).toMatchObject({ cellId: newCellId, exitDate: null });
    });

    it('reverts an ankle monitor and a transfer too', async () => {
      const first = await createInmate('Preso Reversão Tornozeleira');
      const second = await createInmate('Preso Reversão Transferência');
      await request(app.getHttpServer())
        .post('/api/v1/movements/final/ankle-monitor')
        .set('Authorization', `Bearer ${wardenToken}`)
        .send({ inmateId: first.inmateId, reason: 'Dispositivo lançado por engano' });
      await request(app.getHttpServer())
        .post('/api/v1/movements/final/transfer')
        .set('Authorization', `Bearer ${wardenToken}`)
        .send({ inmateId: second.inmateId, reason: 'Transferência lançada por engano' });

      const firstRes = await reverse(wardenToken, {
        inmateId: first.inmateId,
        destinationCellId: first.cellId,
        reason: 'Erro de lançamento',
      });
      const secondRes = await reverse(wardenToken, {
        inmateId: second.inmateId,
        destinationCellId: second.cellId,
        reason: 'Erro de lançamento',
      });

      expect(firstRes.status).toBe(201);
      expect(secondRes.status).toBe(201);
    });

    it('rejects PRISON_OFFICER and SUPERVISOR (403)', async () => {
      const { inmateId, cellId } = await createInmate('Preso Reversão RBAC');
      await release(inmateId);
      const supervisorLogin = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: TEST_FIXTURE.supervisorEmail, password: TEST_FIXTURE.password });
      const supervisorToken = (supervisorLogin.body as { accessToken: string }).accessToken;
      const body = { inmateId, destinationCellId: cellId, reason: 'Erro' };

      expect((await reverse(officerToken, body)).status).toBe(403);
      expect((await reverse(supervisorToken, body)).status).toBe(403);
    });

    it('rejects an inmate that is still ACTIVE (409)', async () => {
      const { inmateId, cellId } = await createInmate('Preso Ativo Reversão');

      const res = await reverse(wardenToken, {
        inmateId,
        destinationCellId: cellId,
        reason: 'Erro',
      });

      expect(res.status).toBe(409);
    });

    it('requires a reason (400) and a destination cell with a vacancy (400)', async () => {
      const { inmateId, galleryId } = await createInmate('Preso Reversão Validação');
      const fullCellId = await createCell(galleryId, '03', 1);
      await request(app.getHttpServer())
        .post('/api/v1/inmates')
        .set('Authorization', `Bearer ${wardenToken}`)
        .send({ name: 'Ocupante da cela cheia', currentCellId: fullCellId });
      await release(inmateId);

      const noReason = await reverse(wardenToken, { inmateId, destinationCellId: fullCellId });
      const full = await reverse(wardenToken, {
        inmateId,
        destinationCellId: fullCellId,
        reason: 'Erro',
      });

      expect(noReason.status).toBe(400);
      expect(full.status).toBe(400);
    });
  });

  describe('GET /inmates/:id/location-history (FR-016)', () => {
    it('reconstructs the full cell timeline across a cell-change and a final situation', async () => {
      const { inmateId, cellId: originCellId, galleryId } = await createInmate('Preso Histórico');
      const destCellRes = await request(app.getHttpServer())
        .post('/api/v1/cells')
        .set('Authorization', `Bearer ${wardenToken}`)
        .send({ galleryId, code: '02', capacity: 2, type: 'SHARED' });
      const destinationCellId = (destCellRes.body as { id: number }).id;

      await request(app.getHttpServer())
        .post('/api/v1/movements/cell-change')
        .set('Authorization', `Bearer ${wardenToken}`)
        .send({ inmateId, destinationCellId, reason: 'Reorganização' });

      await request(app.getHttpServer())
        .post('/api/v1/movements/final/release')
        .set('Authorization', `Bearer ${wardenToken}`)
        .send({ inmateId, reason: 'Alvará nº 999' });

      const historyRes = await request(app.getHttpServer())
        .get(`/api/v1/inmates/${inmateId}/location-history`)
        .set('Authorization', `Bearer ${wardenToken}`);
      expect(historyRes.status).toBe(200);

      const entries = historyRes.body as {
        cellId: number;
        exitDate: string | null;
        reason: string | null;
      }[];
      expect(entries).toHaveLength(2);
      expect(entries[0]).toMatchObject({ cellId: originCellId, reason: 'CELL_CHANGE' });
      expect(entries[0].exitDate).not.toBeNull();
      expect(entries[1]).toMatchObject({ cellId: destinationCellId, reason: 'RELEASE' });
      expect(entries[1].exitDate).not.toBeNull();
    });

    it('rejects an inmate outside the caller unit scope (403/404)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/inmates/999999/location-history')
        .set('Authorization', `Bearer ${wardenToken}`);
      expect([403, 404]).toContain(res.status);
    });
  });
});
