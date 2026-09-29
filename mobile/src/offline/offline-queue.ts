import { getDatabase } from './database';
import { generateIdempotencyKey } from './idempotency-key';

/** Matches the POST /api/v1/movements body shape (contracts/movements.md). */
export interface MovementPayload {
  inmateId: number;
  movementTypeId: number;
  originCellId: number;
  /** Obrigatório — rastreabilidade de para onde o preso foi (research.md #26). */
  destinationLocation: string;
  /** Obrigatório em qualquer tipo de Movimentação (FR-008a, research.md #35) — mesma regra do backend. */
  reason: string;
}

export interface PendingMovement {
  id: number;
  idempotencyKey: string;
  payload: MovementPayload;
  createdAt: string;
  /** Motivo devolvido pelo servidor na última recusa definitiva (T129) — `null` enquanto ainda não foi tentado ou não foi recusado. */
  rejectionReason: string | null;
}

interface PendingMovementRow {
  id: number;
  idempotency_key: string;
  payload: string;
  created_at: string;
  rejection_reason: string | null;
}

export interface PendingReturn {
  id: number;
  idempotencyKey: string;
  movementId: number;
  createdAt: string;
  /** Motivo devolvido pelo servidor na última recusa definitiva (T129) — `null` enquanto ainda não foi tentado ou não foi recusado. */
  rejectionReason: string | null;
}

interface PendingReturnRow {
  id: number;
  idempotency_key: string;
  movement_id: number;
  created_at: string;
  rejection_reason: string | null;
}

/**
 * Enqueues a movement exit locally and returns its idempotency key (FR-011a).
 *
 * Regra definida com o usuário em 2026-09-24, após o QA do Cenário 7 achar
 * que registrar duas saídas offline pro mesmo preso enfileirava as duas — a
 * segunda sempre é rejeitada pelo backend (o preso só pode ter uma
 * movimentação temporária ativa por vez, ver `movements.service.ts`), e
 * antes isso travava a sincronização de TODA a fila (ver sync-service.ts).
 * A oficial continua podendo registrar quantas saídas quiser pro mesmo preso
 * enquanto está offline (a UI não bloqueia isso), mas só a mais recente é
 * mantida na fila local — qualquer saída anterior ainda não sincronizada pro
 * mesmo preso é descartada antes mesmo de tentar ir pro servidor.
 */
export async function enqueueMovement(payload: MovementPayload): Promise<string> {
  const db = await getDatabase();

  const stalePending = await getPendingMovements();
  for (const stale of stalePending) {
    if (stale.payload.inmateId === payload.inmateId) {
      await db.runAsync('DELETE FROM pending_movements WHERE id = ?;', stale.id);
    }
  }

  const idempotencyKey = generateIdempotencyKey();
  await db.runAsync(
    'INSERT INTO pending_movements (idempotency_key, payload) VALUES (?, ?);',
    idempotencyKey,
    JSON.stringify(payload),
  );
  return idempotencyKey;
}

export async function getPendingMovements(): Promise<PendingMovement[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<PendingMovementRow>(
    'SELECT id, idempotency_key, payload, created_at, rejection_reason FROM pending_movements WHERE synced_at IS NULL ORDER BY id ASC;',
  );
  return rows.map((row) => ({
    id: row.id,
    idempotencyKey: row.idempotency_key,
    payload: JSON.parse(row.payload) as MovementPayload,
    createdAt: row.created_at,
    rejectionReason: row.rejection_reason,
  }));
}

export async function markMovementSynced(id: number): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    "UPDATE pending_movements SET synced_at = datetime('now'), rejection_reason = NULL WHERE id = ?;",
    id,
  );
}

/** Guarda o motivo de uma recusa definitiva do servidor (T129) — o item continua na fila pra ser tentado de novo, mas agora com o motivo visível ao usuário. */
export async function markMovementRejected(id: number, reason: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('UPDATE pending_movements SET rejection_reason = ? WHERE id = ?;', reason, id);
}

/**
 * Enqueues a movement return locally (FR-011a). `movementId` is always a real
 * server id here — it's read off `inmate.currentMovement`, which itself only
 * ever comes from an online `GET /inmates` response (the app never lets an
 * officer pick a not-yet-synced local exit to return, so there's no case of
 * "return a movement that only exists as a queued exit" to resolve here).
 *
 * Mesma regra de "mantém só a mais recente" do `enqueueMovement` acima,
 * aplicada aqui por simetria — evita duas tentativas de retorno pendentes
 * pro mesmo `movementId` (ex.: o oficial toca "Confirmar Retorno" duas vezes
 * offline), o que faria a segunda ser recusada pelo backend (já retornado).
 */
export async function enqueueReturn(movementId: number): Promise<string> {
  const db = await getDatabase();

  const stalePending = await getPendingReturns();
  for (const stale of stalePending) {
    if (stale.movementId === movementId) {
      await db.runAsync('DELETE FROM pending_returns WHERE id = ?;', stale.id);
    }
  }

  const idempotencyKey = generateIdempotencyKey();
  await db.runAsync(
    'INSERT INTO pending_returns (idempotency_key, movement_id) VALUES (?, ?);',
    idempotencyKey,
    movementId,
  );
  return idempotencyKey;
}

export async function getPendingReturns(): Promise<PendingReturn[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<PendingReturnRow>(
    'SELECT id, idempotency_key, movement_id, created_at, rejection_reason FROM pending_returns WHERE synced_at IS NULL ORDER BY id ASC;',
  );
  return rows.map((row) => ({
    id: row.id,
    idempotencyKey: row.idempotency_key,
    movementId: row.movement_id,
    createdAt: row.created_at,
    rejectionReason: row.rejection_reason,
  }));
}

export async function markReturnSynced(id: number): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    "UPDATE pending_returns SET synced_at = datetime('now'), rejection_reason = NULL WHERE id = ?;",
    id,
  );
}

/** Guarda o motivo de uma recusa definitiva do servidor (T129) — o item continua na fila pra ser tentado de novo, mas agora com o motivo visível ao usuário. */
export async function markReturnRejected(id: number, reason: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('UPDATE pending_returns SET rejection_reason = ? WHERE id = ?;', reason, id);
}

/** Total unsynced items — drives the "pendente de sincronização" indicator (quickstart.md Cenário 7). */
export async function countPending(): Promise<number> {
  const [movements, returns] = await Promise.all([getPendingMovements(), getPendingReturns()]);
  return movements.length + returns.length;
}
