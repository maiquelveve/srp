import axios from 'axios';
import NetInfo from '@react-native-community/netinfo';
import { apiClient } from '../services/api-client';
import {
  getPendingMovements,
  getPendingReturns,
  markMovementSynced,
  markReturnSynced,
} from './offline-queue';

export interface SyncResult {
  syncedMovements: number;
  syncedReturns: number;
  /** Itens que o servidor recusou de forma definitiva (não é falha de rede) —
   * continuam na fila local pra alguém investigar, mas não travam mais os
   * itens seguintes (ver `isDefiniteRejection` abaixo). */
  rejected: number;
}

/**
 * true só quando o servidor respondeu recusando o pedido (4xx/5xx) — nesse
 * caso repetir a mesma requisição sem mudar nada nunca vai funcionar
 * sozinho, então não faz sentido travar a fila inteira por causa disso.
 * Erro de rede/timeout (sem resposta do servidor) continua interrompendo a
 * sincronização inteira — sem conectividade real, tentar os próximos itens
 * também falharia, e é melhor preservar a ordem pro próximo evento de
 * reconexão do que gerar uma sequência de erros.
 */
function isDefiniteRejection(error: unknown): boolean {
  return axios.isAxiosError(error) && error.response != null;
}

/**
 * Flushes the local queue once connectivity is restored. The backend treats
 * the same `Idempotency-Key` as a no-op on retry (contracts/movements.md),
 * so a crash mid-sync never produces a duplicate movement/return. Exits sync
 * before returns — a return can reference a movement created in this same
 * session, so preserving that order avoids syncing a return before the
 * server even knows about its movement (it's still resolved by a real
 * server-assigned movementId either way, see offline-queue.ts).
 *
 * Achado do QA de 2026-09-24 (quickstart.md Cenário 7): antes, QUALQUER
 * erro no meio da fila (inclusive uma recusa definitiva do servidor, não só
 * falha de rede) abortava a função inteira — um item de um preso travava a
 * sincronização de itens completamente diferentes, de outros presos,
 * indefinidamente. Agora só um erro de rede real aborta o lote (preserva a
 * ordem pra reconexão); uma recusa definitiva do servidor pula só aquele
 * item e segue para os próximos.
 */
export async function syncPendingMovements(): Promise<SyncResult> {
  const result: SyncResult = { syncedMovements: 0, syncedReturns: 0, rejected: 0 };

  const pendingMovements = await getPendingMovements();
  for (const movement of pendingMovements) {
    try {
      await apiClient.post('/movements', movement.payload, {
        headers: { 'Idempotency-Key': movement.idempotencyKey },
      });
      await markMovementSynced(movement.id);
      result.syncedMovements += 1;
    } catch (error) {
      if (isDefiniteRejection(error)) {
        result.rejected += 1;
        continue;
      }
      // Falha de rede/timeout — para o lote inteiro aqui, mantendo a ordem
      // dos itens restantes (nada foi perdido, só não foi tentado ainda).
      return result;
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
      result.syncedReturns += 1;
    } catch (error) {
      if (isDefiniteRejection(error)) {
        result.rejected += 1;
        continue;
      }
      return result;
    }
  }

  return result;
}

export function startOfflineSyncListener(): () => void {
  return NetInfo.addEventListener((state) => {
    if (state.isConnected) {
      void syncPendingMovements();
    }
  });
}
