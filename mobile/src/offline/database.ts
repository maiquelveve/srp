import * as SQLite from 'expo-sqlite';

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

/**
 * Local persistent queue for movements registered while offline (FR-011a).
 * A pure in-memory queue would be lost if the app is killed — SQLite
 * survives that (research.md #4).
 */
export function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  dbPromise ??= (async () => {
    const db = await SQLite.openDatabaseAsync('srp-offline.db');
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS pending_movements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        idempotency_key TEXT NOT NULL UNIQUE,
        payload TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        synced_at TEXT
      );
      CREATE TABLE IF NOT EXISTS pending_returns (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        idempotency_key TEXT NOT NULL UNIQUE,
        movement_id INTEGER NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        synced_at TEXT
      );
    `);
    return db;
  })();
  return dbPromise;
}
