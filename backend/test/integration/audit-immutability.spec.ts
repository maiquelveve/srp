import 'dotenv/config';
import { Client } from 'pg';

/**
 * `audit_logs` is immutable at the database level (Constitution III, FR-027,
 * migration MakeAuditLogsImmutable). Connects as the same user the app uses,
 * which owns the table, to prove the guard holds even for the owner.
 */
describe('audit_logs immutability (database trigger)', () => {
  let client: Client;
  let insertedId: number;

  beforeAll(async () => {
    client = new Client({
      host: process.env.POSTGRES_HOST,
      port: Number(process.env.POSTGRES_PORT),
      user: process.env.POSTGRES_USER,
      password: process.env.POSTGRES_PASSWORD,
      database: process.env.POSTGRES_DB,
    });
    await client.connect();

    const inserted = await client.query<{ id: number }>(
      `INSERT INTO "audit_logs" ("action", "affected_table") VALUES ('LOGIN', 'immutability_test') RETURNING "id"`,
    );
    insertedId = inserted.rows[0].id;
  });

  afterAll(async () => {
    await client.end();
  });

  it('still allows INSERT', () => {
    expect(insertedId).toEqual(expect.any(Number));
  });

  it('rejects UPDATE', async () => {
    await expect(
      client.query(`UPDATE "audit_logs" SET "action" = 'LOGOUT' WHERE "id" = $1`, [insertedId]),
    ).rejects.toThrow(/audit_logs is immutable: UPDATE/);
  });

  it('rejects DELETE', async () => {
    await expect(
      client.query(`DELETE FROM "audit_logs" WHERE "id" = $1`, [insertedId]),
    ).rejects.toThrow(/audit_logs is immutable: DELETE/);
  });

  it('rejects TRUNCATE', async () => {
    await expect(client.query(`TRUNCATE "audit_logs"`)).rejects.toThrow(
      /audit_logs is immutable: TRUNCATE/,
    );
  });

  it('keeps the row unchanged after the rejected attempts', async () => {
    const { rows } = await client.query<{ action: string }>(
      `SELECT "action" FROM "audit_logs" WHERE "id" = $1`,
      [insertedId],
    );
    expect(rows).toEqual([{ action: 'LOGIN' }]);
  });
});
