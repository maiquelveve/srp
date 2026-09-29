import * as SQLite from 'expo-sqlite';

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

interface TableColumnInfo {
  name: string;
}

/**
 * Migração simples e idempotente pra adicionar uma coluna opcional a uma
 * tabela já existente no aparelho (T129, research.md #55) — `expo-sqlite`
 * não tem `ADD COLUMN IF NOT EXISTS`, então confere via `PRAGMA table_info`
 * antes de alterar. Não mexe nas linhas já gravadas.
 */
async function ensureColumn(db: SQLite.SQLiteDatabase, table: string, column: string): Promise<void> {
  const columns = await db.getAllAsync<TableColumnInfo>(`PRAGMA table_info(${table});`);
  const alreadyExists = columns.some((existingColumn) => existingColumn.name === column);
  if (!alreadyExists) {
    await db.execAsync(`ALTER TABLE ${table} ADD COLUMN ${column} TEXT;`);
  }
}

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
    // Guarda o motivo quando o servidor recusa definitivamente um item da
    // fila (T129) — coluna opcional, adicionada depois das tabelas já
    // existirem em aparelhos com dados antigos, sem apagar nada.
    await ensureColumn(db, 'pending_movements', 'rejection_reason');
    await ensureColumn(db, 'pending_returns', 'rejection_reason');
    return db;
  })();
  return dbPromise;
}
