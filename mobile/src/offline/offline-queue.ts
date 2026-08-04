import { getDatabase } from './database';
import { generateIdempotencyKey } from './idempotency-key';

/** Matches the POST /api/v1/movements body shape (contracts/movements.md). */
export interface MovementPayload {
  inmateId: number;
  movementTypeId: number;
  originCellId: number;
  destinationLocation?: string;
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

/** Enqueues a movement locally and returns its idempotency key (FR-011a). */
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
  await db.runAsync(
    "UPDATE pending_movements SET synced_at = datetime('now') WHERE id = ?;",
    id,
  );
}
