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
});
