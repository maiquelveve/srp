import { getDatabase } from './database';
import { generateIdempotencyKey } from './idempotency-key';

/** Matches the POST /api/v1/movements body shape (contracts/movements.md). */
export interface MovementPayload {
  inmateId: number;
  movementTypeId: number;
  originCellId: number;
  /** Obrigatório — rastreabilidade de para onde o preso foi (research.md #26). */
  destinationLocation: string;
  reason?: string;
}

export interface PendingMovement {
  id: number;
  idempotencyKey: string;
  payload: MovementPayload;
  createdAt: string;
}

interface PendingMovementRow {
  id: number;
  idempotency_key: string;
  payload: string;
  created_at: string;
}

export interface PendingReturn {
  id: number;
  idempotencyKey: string;
  movementId: number;
  createdAt: string;
}

interface PendingReturnRow {
  id: number;
  idempotency_key: string;
  movement_id: number;
  created_at: string;
}

/** Enqueues a movement exit locally and returns its idempotency key (FR-011a). */
export async function enqueueMovement(payload: MovementPayload): Promise<string> {
  const db = await getDatabase();
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
    'SELECT id, idempotency_key, payload, created_at FROM pending_movements WHERE synced_at IS NULL ORDER BY id ASC;',
  );
  return rows.map((row) => ({
    id: row.id,
    idempotencyKey: row.idempotency_key,
    payload: JSON.parse(row.payload) as MovementPayload,
    createdAt: row.created_at,
  }));
}

export async function markMovementSynced(id: number): Promise<void> {
  const db = await getDatabase();
  await db.runAsync("UPDATE pending_movements SET synced_at = datetime('now') WHERE id = ?;", id);
}

/**
 * Enqueues a movement return locally (FR-011a). `movementId` is always a real
 * server id here — it's read off `inmate.currentMovement`, which itself only
 * ever comes from an online `GET /inmates` response (the app never lets an
 * officer pick a not-yet-synced local exit to return, so there's no case of
 * "return a movement that only exists as a queued exit" to resolve here).
 */
export async function enqueueReturn(movementId: number): Promise<string> {
  const db = await getDatabase();
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
    'SELECT id, idempotency_key, movement_id, created_at FROM pending_returns WHERE synced_at IS NULL ORDER BY id ASC;',
  );
  return rows.map((row) => ({
    id: row.id,
    idempotencyKey: row.idempotency_key,
    movementId: row.movement_id,
    createdAt: row.created_at,
  }));
}

export async function markReturnSynced(id: number): Promise<void> {
  const db = await getDatabase();
  await db.runAsync("UPDATE pending_returns SET synced_at = datetime('now') WHERE id = ?;", id);
}

/** Total unsynced items — drives the "pendente de sincronização" indicator (quickstart.md Cenário 7). */
export async function countPending(): Promise<number> {
  const [movements, returns] = await Promise.all([getPendingMovements(), getPendingReturns()]);
  return movements.length + returns.length;
}
