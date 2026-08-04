import NetInfo from '@react-native-community/netinfo';
import { apiClient } from '../services/api-client';
import { getPendingMovements, markMovementSynced } from './offline-queue';

/**
 * Flushes the local queue once connectivity is restored. The backend treats
 * the same `Idempotency-Key` as a no-op on retry (contracts/movements.md),
 * so a crash mid-sync never produces a duplicate movement.
 */
export async function syncPendingMovements(): Promise<void> {
  const pending = await getPendingMovements();
  for (const movement of pending) {
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
}

export function startOfflineSyncListener(): () => void {
  return NetInfo.addEventListener((state) => {
    if (state.isConnected) {
      void syncPendingMovements();
    }
  });
}
