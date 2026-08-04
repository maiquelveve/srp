import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Initial schema — hand-written to mirror docs/srp_spec_database_model.md exactly.
 *
 * NOTE: written without a live PostgreSQL connection available in this
 * environment (Docker Desktop WSL integration not enabled here), so it was
 * not produced via `typeorm migration:generate`. Once Postgres is reachable,
 * run `npm run migration:run` to apply it, and verify with
 * `typeorm migration:generate` producing an empty diff to confirm entities
 * and migration are in sync.
 */
export class InitialSchema1785931200000 implements MigrationInterface {
  name = 'InitialSchema1785931200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "roles" (
        "id" SERIAL PRIMARY KEY,
        "name" VARCHAR(50) NOT NULL UNIQUE,
        "description" TEXT
      );
    `);

    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" SERIAL PRIMARY KEY,
        "name" VARCHAR(150) NOT NULL,
        "email" VARCHAR(150) NOT NULL UNIQUE,
        "password_hash" VARCHAR(255) NOT NULL,
        "badge_number" VARCHAR(50) UNIQUE,
        "job_title" VARCHAR(100),
        "role_id" INTEGER NOT NULL REFERENCES "roles"("id"),
        "active" BOOLEAN NOT NULL DEFAULT TRUE,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);

    await queryRunner.query(`
      CREATE TABLE "user_units" (
        "user_id" INTEGER NOT NULL REFERENCES "users"("id"),
        "unit_id" INTEGER NOT NULL,
        PRIMARY KEY ("user_id", "unit_id")
      );
    `);

    await queryRunner.query(`
      CREATE TABLE "refresh_tokens" (
        "id" SERIAL PRIMARY KEY,
        "user_id" INTEGER NOT NULL REFERENCES "users"("id"),
        "token_hash" VARCHAR(255) NOT NULL UNIQUE,
        "expires_at" TIMESTAMPTZ NOT NULL,
        "revoked_at" TIMESTAMPTZ,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);

    await queryRunner.query(`
      CREATE TABLE "invite_tokens" (
        "id" SERIAL PRIMARY KEY,
        "user_id" INTEGER NOT NULL REFERENCES "users"("id"),
        "token_hash" VARCHAR(255) NOT NULL UNIQUE,
        "expires_at" TIMESTAMPTZ NOT NULL,
        "used_at" TIMESTAMPTZ,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);

    await queryRunner.query(`
      CREATE TABLE "units" (
        "id" SERIAL PRIMARY KEY,
        "name" VARCHAR(150) NOT NULL,
        "code" VARCHAR(20) UNIQUE,
        "address" TEXT,
        "phone" VARCHAR(50),
        "active" BOOLEAN NOT NULL DEFAULT TRUE,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);

    await queryRunner.query(`
      ALTER TABLE "user_units" ADD CONSTRAINT "FK_user_units_unit" FOREIGN KEY ("unit_id") REFERENCES "units"("id");
    `);

    await queryRunner.query(`
      CREATE TABLE "galleries" (
        "id" SERIAL PRIMARY KEY,
        "unit_id" INTEGER NOT NULL REFERENCES "units"("id"),
        "code" VARCHAR(50) NOT NULL,
        "description" TEXT,
        "type" VARCHAR(50),
        "active" BOOLEAN NOT NULL DEFAULT TRUE,
        UNIQUE ("unit_id", "code")
      );
    `);

    await queryRunner.query(`
      CREATE TABLE "cells" (
        "id" SERIAL PRIMARY KEY,
        "gallery_id" INTEGER NOT NULL REFERENCES "galleries"("id"),
        "code" VARCHAR(20) NOT NULL,
        "capacity" INTEGER NOT NULL DEFAULT 0,
        "type" VARCHAR(50),
        "active" BOOLEAN NOT NULL DEFAULT TRUE,
        UNIQUE ("gallery_id", "code")
      );
    `);

    await queryRunner.query(`
      CREATE TABLE "inmates" (
        "id" SERIAL PRIMARY KEY,
        "name" VARCHAR(200) NOT NULL,
        "registration_id" VARCHAR(50) UNIQUE,
        "birth_date" DATE,
        "custody_regime" VARCHAR(50),
        "photo_url" TEXT,
        "status" VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
        "current_cell_id" INTEGER NOT NULL REFERENCES "cells"("id"),
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);

    await queryRunner.query(`
      CREATE TABLE "inmate_cell_history" (
        "id" SERIAL PRIMARY KEY,
        "inmate_id" INTEGER NOT NULL REFERENCES "inmates"("id"),
        "cell_id" INTEGER NOT NULL REFERENCES "cells"("id"),
        "entry_date" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "exit_date" TIMESTAMPTZ,
        "reason" VARCHAR(100),
        "user_id" INTEGER REFERENCES "users"("id")
      );
    `);

    await queryRunner.query(`
      CREATE TABLE "movement_types" (
        "id" SERIAL PRIMARY KEY,
        "name" VARCHAR(100) NOT NULL UNIQUE,
        "category" VARCHAR(50) NOT NULL,
        "description" TEXT
      );
    `);

    await queryRunner.query(`
      CREATE TABLE "movements" (
        "id" SERIAL PRIMARY KEY,
        "inmate_id" INTEGER NOT NULL REFERENCES "inmates"("id"),
        "movement_type_id" INTEGER NOT NULL REFERENCES "movement_types"("id"),
        "origin_cell_id" INTEGER NOT NULL REFERENCES "cells"("id"),
        "destination_cell_id" INTEGER REFERENCES "cells"("id"),
        "destination_location" TEXT,
        "reason" TEXT,
        "exit_datetime" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "return_datetime" TIMESTAMPTZ,
        "notes" TEXT,
        "idempotency_key" UUID UNIQUE,
        "user_id" INTEGER NOT NULL REFERENCES "users"("id"),
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);

    await queryRunner.query(`
      CREATE TABLE "routines" (
        "id" SERIAL PRIMARY KEY,
        "name" VARCHAR(100) NOT NULL,
        "type" VARCHAR(50) NOT NULL,
        "description" TEXT,
        "gallery_id" INTEGER NOT NULL REFERENCES "galleries"("id"),
        "active" BOOLEAN NOT NULL DEFAULT TRUE,
        "locked" BOOLEAN NOT NULL DEFAULT FALSE,
        "created_by" INTEGER REFERENCES "users"("id"),
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);

    await queryRunner.query(`
      CREATE TABLE "routine_schedules" (
        "id" SERIAL PRIMARY KEY,
        "routine_id" INTEGER NOT NULL REFERENCES "routines"("id"),
        "weekday" INTEGER,
        "time" TIME NOT NULL,
        "active" BOOLEAN NOT NULL DEFAULT TRUE,
        UNIQUE ("routine_id", "weekday", "time")
      );
    `);

    await queryRunner.query(`
      CREATE TABLE "staff_schedules" (
        "id" SERIAL PRIMARY KEY,
        "user_id" INTEGER NOT NULL REFERENCES "users"("id"),
        "unit_id" INTEGER NOT NULL REFERENCES "units"("id"),
        "gallery_id" INTEGER REFERENCES "galleries"("id"),
        "date" DATE NOT NULL,
        "shift" VARCHAR(20) NOT NULL,
        "sector" VARCHAR(100),
        "attendance_status" VARCHAR(20),
        "absence_reason" TEXT,
        "overtime_hours" NUMERIC(5,2) NOT NULL DEFAULT 0,
        UNIQUE ("user_id", "date", "shift")
      );
    `);

    await queryRunner.query(`
      CREATE TABLE "minimum_staffing_config" (
        "id" SERIAL PRIMARY KEY,
        "unit_id" INTEGER NOT NULL REFERENCES "units"("id"),
        "sector" VARCHAR(100) NOT NULL,
        "shift" VARCHAR(20) NOT NULL,
        "minimum_headcount" INTEGER NOT NULL,
        "updated_by" INTEGER REFERENCES "users"("id"),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE ("unit_id", "sector", "shift")
      );
    `);

    await queryRunner.query(`
      CREATE TABLE "audit_logs" (
        "id" SERIAL PRIMARY KEY,
        "user_id" INTEGER REFERENCES "users"("id"),
        "affected_table" VARCHAR(50),
        "record_id" INTEGER,
        "action" VARCHAR(20) NOT NULL,
        "old_data" JSONB,
        "new_data" JSONB,
        "timestamp" TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_inmates_current_cell" ON "inmates" ("current_cell_id");`,
    );
    await queryRunner.query(`CREATE INDEX "IDX_inmates_status" ON "inmates" ("status");`);
    await queryRunner.query(`CREATE INDEX "IDX_movements_inmate" ON "movements" ("inmate_id");`);
    await queryRunner.query(`CREATE INDEX "IDX_movements_date" ON "movements" ("exit_datetime");`);
    await queryRunner.query(`CREATE INDEX "IDX_movements_user" ON "movements" ("user_id");`);
    await queryRunner.query(
      `CREATE INDEX "IDX_staff_schedules_date" ON "staff_schedules" ("date");`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_audit_logs_timestamp" ON "audit_logs" ("timestamp");`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_refresh_tokens_user" ON "refresh_tokens" ("user_id");`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_audit_logs_affected_table" ON "audit_logs" ("affected_table");`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "audit_logs";`);
    await queryRunner.query(`DROP TABLE "minimum_staffing_config";`);
    await queryRunner.query(`DROP TABLE "staff_schedules";`);
    await queryRunner.query(`DROP TABLE "routine_schedules";`);
    await queryRunner.query(`DROP TABLE "routines";`);
    await queryRunner.query(`DROP TABLE "movements";`);
    await queryRunner.query(`DROP TABLE "movement_types";`);
    await queryRunner.query(`DROP TABLE "inmate_cell_history";`);
    await queryRunner.query(`DROP TABLE "inmates";`);
    await queryRunner.query(`DROP TABLE "cells";`);
    await queryRunner.query(`DROP TABLE "galleries";`);
    await queryRunner.query(`DROP TABLE "user_units";`);
    await queryRunner.query(`DROP TABLE "units";`);
    await queryRunner.query(`DROP TABLE "invite_tokens";`);
    await queryRunner.query(`DROP TABLE "refresh_tokens";`);
    await queryRunner.query(`DROP TABLE "users";`);
    await queryRunner.query(`DROP TABLE "roles";`);
  }
}
