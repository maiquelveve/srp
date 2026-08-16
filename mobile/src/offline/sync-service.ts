import NetInfo from '@react-native-community/netinfo';
import { apiClient } from '../services/api-client';
import {
  getPendingMovements,
  getPendingReturns,
  markMovementSynced,
  markReturnSynced,
} from './offline-queue';

/**
 * Flushes the local queue once connectivity is restored. The backend treats
 * the same `Idempotency-Key` as a no-op on retry (contracts/movements.md),
 * so a crash mid-sync never produces a duplicate movement/return. Exits sync
 * before returns — a return can reference a movement created in this same
 * session, so preserving that order avoids syncing a return before the
 * server even knows about its movement (it's still resolved by a real
 * server-assigned movementId either way, see offline-queue.ts).
 */
export async function syncPendingMovements(): Promise<void> {
  const pendingMovements = await getPendingMovements();
  for (const movement of pendingMovements) {
    try {
      await apiClient.post('/movements', movement.payload, {
        headers: { 'Idempotency-Key': movement.idempotencyKey },
      });
      await markMovementSynced(movement.id);
    } catch {
      // Stop on the first failure — keep remaining items queued in order,
      // retry on the next connectivity event instead of reordering writes.
      return;
    }
  }

  const pendingReturns = await getPendingReturns();
  for (const pendingReturn of pendingReturns) {
    try {
      await apiClient.patch(
        `/movements/${pendingReturn.movementId}/return`,
        {},
        { headers: { 'Idempotency-Key': pendingReturn.idempotencyKey } },
      );
      await markReturnSynced(pendingReturn.id);
    } catch {
      return;
    }
  }
}

export function startOfflineSyncListener(): () => void {
  return NetInfo.addEventListener((state) => {
    if (state.isConnected) {
      void syncPendingMovements();
    }
  });
}
