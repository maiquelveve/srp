/**
 * Mobile offline-sync tests (quickstart.md Cenário 7 — FR-011a): queue a
 * movement/return while offline, then flush on reconnect with no duplicates.
 *
 * `../src/offline/database` (real `expo-sqlite`) and `../src/services/api-client`
 * (real `axios`/`AsyncStorage`) are mocked out — this exercises the actual
 * ordering/idempotency/error-handling logic in `sync-service.ts` and
 * `offline-queue.ts` against an in-memory fake persistence layer, not
 * SQLite/network themselves.
 */
import { apiClient } from '../src/services/api-client';
import {
  enqueueMovement,
  enqueueReturn,
  getPendingMovements,
  getPendingReturns,
} from '../src/offline/offline-queue';
import { syncPendingMovements } from '../src/offline/sync-service';
import * as offlineDatabase from '../src/offline/database';

jest.mock('../src/services/api-client', () => ({
  apiClient: { post: jest.fn(), patch: jest.fn() },
}));

jest.mock('../src/offline/database', () => {
  let movements: Array<{
    id: number;
    idempotency_key: string;
    payload: string;
    created_at: string;
    synced_at: string | null;
  }> = [];
  let returns: Array<{
    id: number;
    idempotency_key: string;
    movement_id: number;
    created_at: string;
    synced_at: string | null;
  }> = [];
  let nextMovementId = 1;
  let nextReturnId = 1;

  const fakeDb = {
    runAsync: async (sql: string, ...params: unknown[]) => {
      if (sql.startsWith('INSERT INTO pending_movements')) {
        movements.push({
          id: nextMovementId++,
          idempotency_key: params[0] as string,
          payload: params[1] as string,
          created_at: new Date().toISOString(),
          synced_at: null,
        });
      } else if (sql.startsWith('UPDATE pending_movements')) {
        const row = movements.find((m) => m.id === params[0]);
        if (row) row.synced_at = new Date().toISOString();
      } else if (sql.startsWith('INSERT INTO pending_returns')) {
        returns.push({
          id: nextReturnId++,
          idempotency_key: params[0] as string,
          movement_id: params[1] as number,
          created_at: new Date().toISOString(),
          synced_at: null,
        });
      } else if (sql.startsWith('UPDATE pending_returns')) {
        const row = returns.find((r) => r.id === params[0]);
        if (row) row.synced_at = new Date().toISOString();
      } else if (sql.startsWith('DELETE FROM pending_movements')) {
        movements = movements.filter((m) => m.id !== params[0]);
      } else if (sql.startsWith('DELETE FROM pending_returns')) {
        returns = returns.filter((r) => r.id !== params[0]);
      }
    },
    getAllAsync: async (sql: string) => {
      if (sql.includes('pending_movements')) {
        return movements.filter((m) => m.synced_at === null);
      }
      return returns.filter((r) => r.synced_at === null);
    },
  };

  return {
    getDatabase: async () => fakeDb,
    __reset: () => {
      movements = [];
      returns = [];
      nextMovementId = 1;
      nextReturnId = 1;
    },
  };
});

const mockedApiClient = apiClient as unknown as { post: jest.Mock; patch: jest.Mock };
const resetFakeDb = (offlineDatabase as unknown as { __reset: () => void }).__reset;

describe('Offline sync (quickstart.md Cenário 7, FR-011a)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetFakeDb();
  });

  it('queues a movement exit locally without calling the API (airplane mode)', async () => {
    await enqueueMovement({
      inmateId: 1,
      movementTypeId: 4,
      originCellId: 42,
      destinationLocation: 'Enfermaria',
      reason: 'Consulta',
    });

    expect(mockedApiClient.post).not.toHaveBeenCalled();
    const pending = await getPendingMovements();
    expect(pending).toHaveLength(1);
    expect(pending[0].payload).toMatchObject({ inmateId: 1, movementTypeId: 4, originCellId: 42 });
  });

  it('syncs the queued movement on reconnect using its Idempotency-Key, and never resends it', async () => {
    const idempotencyKey = await enqueueMovement({
      inmateId: 1,
      movementTypeId: 4,
      originCellId: 42,
      destinationLocation: 'Enfermaria',
      reason: 'Consulta',
    });
    mockedApiClient.post.mockResolvedValueOnce({ data: { id: 999 } });

    await syncPendingMovements();

    expect(mockedApiClient.post).toHaveBeenCalledTimes(1);
    expect(mockedApiClient.post).toHaveBeenCalledWith(
      '/movements',
      expect.objectContaining({ inmateId: 1 }),
      { headers: { 'Idempotency-Key': idempotencyKey } },
    );
    expect(await getPendingMovements()).toHaveLength(0);

    // Second reconnect event (or a retried sync call) — no duplicate POST.
    await syncPendingMovements();
    expect(mockedApiClient.post).toHaveBeenCalledTimes(1);
  });

  it('syncs a queued return using a distinct Idempotency-Key, and never resends it', async () => {
    const idempotencyKey = await enqueueReturn(5501);
    mockedApiClient.patch.mockResolvedValueOnce({ data: { id: 5501 } });

    await syncPendingMovements();

    expect(mockedApiClient.patch).toHaveBeenCalledTimes(1);
    expect(mockedApiClient.patch).toHaveBeenCalledWith(
      '/movements/5501/return',
      {},
      { headers: { 'Idempotency-Key': idempotencyKey } },
    );
    expect(await getPendingReturns()).toHaveLength(0);

    await syncPendingMovements();
    expect(mockedApiClient.patch).toHaveBeenCalledTimes(1);
  });

  it('stops on the first failure, preserving queue order for the next retry (no data loss)', async () => {
    await enqueueMovement({
      inmateId: 1,
      movementTypeId: 4,
      originCellId: 42,
      destinationLocation: 'Enfermaria',
      reason: 'Consulta',
    });
    await enqueueMovement({
      inmateId: 2,
      movementTypeId: 4,
      originCellId: 43,
      destinationLocation: 'Ala B',
      reason: 'Consulta',
    });
    mockedApiClient.post.mockRejectedValueOnce(new Error('network down'));

    await syncPendingMovements();

    expect(mockedApiClient.post).toHaveBeenCalledTimes(1);
    expect(await getPendingMovements()).toHaveLength(2);

    // Connectivity returns for real — retry succeeds for both, in order.
    mockedApiClient.post.mockResolvedValue({ data: {} });
    await syncPendingMovements();

    expect(mockedApiClient.post).toHaveBeenCalledTimes(3);
    expect(await getPendingMovements()).toHaveLength(0);
  });

  // Achados do QA de 2026-09-24 (quickstart.md Cenário 7) — regra definida
  // com o usuário: uma nova saída pendente pro mesmo preso substitui
  // qualquer saída anterior ainda não sincronizada (a mais recente é sempre
  // a válida), e uma recusa definitiva do servidor não trava os itens
  // seguintes da fila (antes travava, inclusive itens de outros presos).

  it('supersedes an unsynced pending exit for the same inmate, keeping only the latest', async () => {
    await enqueueMovement({
      inmateId: 16,
      movementTypeId: 5,
      originCellId: 1,
      destinationLocation: 'Forum Central',
      reason: 'Audiência',
    });
    await enqueueMovement({
      inmateId: 16,
      movementTypeId: 1,
      originCellId: 1,
      destinationLocation: 'Hospital',
      reason: 'Atendimento psicológico',
    });

    const pending = await getPendingMovements();
    expect(pending).toHaveLength(1);
    expect(pending[0].payload).toMatchObject({ movementTypeId: 1, reason: 'Atendimento psicológico' });
  });

  it('does not supersede a pending exit for a different inmate', async () => {
    await enqueueMovement({
      inmateId: 16,
      movementTypeId: 5,
      originCellId: 1,
      destinationLocation: 'Forum Central',
      reason: 'Audiência',
    });
    await enqueueMovement({
      inmateId: 17,
      movementTypeId: 1,
      originCellId: 1,
      destinationLocation: 'Hospital',
      reason: 'Atendimento psicológico',
    });

    expect(await getPendingMovements()).toHaveLength(2);
  });

  it('supersedes an unsynced pending return for the same movement', async () => {
    await enqueueReturn(63);
    const secondKey = await enqueueReturn(63);

    const pending = await getPendingReturns();
    expect(pending).toHaveLength(1);
    expect(pending[0].idempotencyKey).toBe(secondKey);
  });

  it('skips a definite server rejection and keeps syncing the rest of the queue, without blocking other inmates', async () => {
    await enqueueMovement({
      inmateId: 16,
      movementTypeId: 1,
      originCellId: 1,
      destinationLocation: 'Hospital',
      reason: 'Já tem saída ativa — backend vai recusar (409)',
    });
    await enqueueMovement({
      inmateId: 14,
      movementTypeId: 2,
      originCellId: 1,
      destinationLocation: 'Enfermaria',
      reason: 'Consulta',
    });

    mockedApiClient.post
      .mockRejectedValueOnce({ isAxiosError: true, response: { status: 409, data: {} } })
      .mockResolvedValueOnce({ data: {} });

    const result = await syncPendingMovements();

    expect(mockedApiClient.post).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ syncedMovements: 1, syncedReturns: 0, rejected: 1 });
    // O item recusado continua na fila (para inspeção), o outro preso sincronizou normalmente.
    const stillPending = await getPendingMovements();
    expect(stillPending).toHaveLength(1);
    expect(stillPending[0].payload.inmateId).toBe(16);
  });

  it('still aborts the whole batch on a real network failure (no server response)', async () => {
    await enqueueMovement({
      inmateId: 16,
      movementTypeId: 1,
      originCellId: 1,
      destinationLocation: 'Hospital',
      reason: 'Sem rede',
    });
    await enqueueMovement({
      inmateId: 14,
      movementTypeId: 2,
      originCellId: 1,
      destinationLocation: 'Enfermaria',
      reason: 'Consulta',
    });
    mockedApiClient.post.mockRejectedValueOnce(new Error('network down'));

    const result = await syncPendingMovements();

    expect(mockedApiClient.post).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ syncedMovements: 0, syncedReturns: 0, rejected: 0 });
    expect(await getPendingMovements()).toHaveLength(2);
  });
});
