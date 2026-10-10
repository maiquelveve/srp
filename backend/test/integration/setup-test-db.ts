import 'reflect-metadata';
import 'dotenv/config';
import { rm } from 'fs/promises';
import { Client } from 'pg';
import * as argon2 from 'argon2';
import { Role, RoleName } from '../../src/roles/entities/role.entity';
import { Unit } from '../../src/units/entities/unit.entity';
import { User } from '../../src/users/entities/user.entity';
import { MovementType, MovementCategory } from '../../src/movements/entities/movement-type.entity';
import { TEST_FIXTURE } from './fixtures';

/**
 * Prepares an isolated PostgreSQL test database (research.md #1) before
 * integration tests run: creates `srp_db_test` if missing, runs migrations
 * against it, truncates all tables, and seeds the minimal fixture every
 * integration test file relies on (2 units, 3 roles, 3 users).
 *
 * Invoked via the `pretest:integration` npm script ONLY — runs automatically
 * before `npm run test:integration`. Must never be imported from a *.spec.ts
 * file (this module runs `main()` as an import-time side effect); import
 * `TEST_FIXTURE` from `./fixtures` instead.
 */
const TEST_DB_NAME = 'srp_db_test';
// Mesmo isolamento de `test/integration/env-setup.ts` (só pra Jest) — este
// script roda fora do Jest, direto via `ts-node`, então precisa setar sozinho.
const TEST_STORAGE_PATH = './storage/documents-test';
const TEST_KNOWLEDGE_STORAGE_PATH = './storage/knowledge-test';

async function ensureTestDatabaseExists(): Promise<void> {
  const maintenanceClient = new Client({
    host: process.env.POSTGRES_HOST,
    port: Number(process.env.POSTGRES_PORT),
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
    database: process.env.POSTGRES_DB,
  });
  await maintenanceClient.connect();
  const { rows } = await maintenanceClient.query('SELECT 1 FROM pg_database WHERE datname = $1', [
    TEST_DB_NAME,
  ]);
  if (rows.length === 0) {
    await maintenanceClient.query(`CREATE DATABASE ${TEST_DB_NAME}`);
  }
  await maintenanceClient.end();
}

async function main(): Promise<void> {
  await ensureTestDatabaseExists();

  // Must happen before data-source.ts is ever imported — its DataSourceOptions
  // are built from process.env at module-load time, and dotenv never
  // overrides an already-set variable, so this sticks for the rest of the process.
  process.env.POSTGRES_DB = TEST_DB_NAME;
  process.env.DOCUMENTS_STORAGE_PATH = TEST_STORAGE_PATH;
  // `documents`/`document_types` não entram no TRUNCATE abaixo (ver nota ali)
  // — limpa os arquivos físicos de uma rodada anterior pra não acumular.
  await rm(TEST_STORAGE_PATH, { recursive: true, force: true });
  process.env.KNOWLEDGE_STORAGE_PATH = TEST_KNOWLEDGE_STORAGE_PATH;
  await rm(TEST_KNOWLEDGE_STORAGE_PATH, { recursive: true, force: true });
  const { AppDataSource } = await import('../../src/database/data-source');

  await AppDataSource.initialize();
  await AppDataSource.runMigrations();

  const tables = [
    'audit_logs',
    // Base de conhecimento (feature 003). `knowledge_queries` é imutável como `audit_logs`:
    // a trigger é desligada logo abaixo só durante o reset.
    'knowledge_queries',
    'knowledge_document_chunks',
    'knowledge_documents',
    // `document_types` fica de fora de propósito: as 3 linhas fixas vêm só
    // do seed da migration `AddDocumentsTables` (roda uma vez só), não há
    // endpoint que crie/edite/remova essa tabela (data-model.md, FR-009).
    'documents',
    'minimum_staffing_config',
    'posts',
    'staff_schedules',
    'routine_date_overrides',
    'routine_schedules',
    'routines',
    'movements',
    'movement_types',
    'inmate_cell_history',
    'inmates',
    'cells',
    'galleries',
    'invite_tokens',
    'refresh_tokens',
    'user_units',
    'units',
    'users',
    'roles',
  ];
  // `audit_logs` is immutable in production (migration MakeAuditLogsImmutable), so
  // the reset has to switch its trigger off first and back on right after. Only the
  // table owner can do this, which is exactly the guarantee the trigger gives.
  await AppDataSource.query(`ALTER TABLE "audit_logs" DISABLE TRIGGER "audit_logs_immutable"`);
  await AppDataSource.query(
    `ALTER TABLE "knowledge_queries" DISABLE TRIGGER "knowledge_queries_immutable"`,
  );
  try {
    await AppDataSource.query(
      `TRUNCATE ${tables.map((t) => `"${t}"`).join(', ')} RESTART IDENTITY CASCADE;`,
    );
  } finally {
    await AppDataSource.query(
      `ALTER TABLE "knowledge_queries" ENABLE TRIGGER "knowledge_queries_immutable"`,
    );
    await AppDataSource.query(`ALTER TABLE "audit_logs" ENABLE TRIGGER "audit_logs_immutable"`);
  }

  const roleRepo = AppDataSource.getRepository(Role);
  const unitRepo = AppDataSource.getRepository(Unit);
  const userRepo = AppDataSource.getRepository(User);
  const movementTypeRepo = AppDataSource.getRepository(MovementType);

  const [officerRole, supervisorRole, wardenRole] = await roleRepo.save([
    { name: RoleName.PRISON_OFFICER, description: 'Policial Penal' },
    { name: RoleName.SUPERVISOR, description: 'Supervisor' },
    { name: RoleName.WARDEN, description: 'Chefia/Diretor' },
  ]);

  const unitA = await unitRepo.save({ name: 'Unidade Teste A', code: 'TEST-A', active: true });
  const unitB = await unitRepo.save({ name: 'Unidade Teste B', code: 'TEST-B', active: true });
  // unitC/D/E: também no escopo do warden de teste (ao lado de unitA) — usadas
  // pelos testes de "trocar"/"adicionar lotação" (FR-004a, feature 002) que
  // precisam de uma unidade de destino diferente mas ainda dentro do escopo
  // do requisitante; unitB continua sendo a única unidade FORA do escopo,
  // usada por todo o resto da suíte para testar o 403 de escopo.
  const unitC = await unitRepo.save({ name: 'Unidade Teste C', code: 'TEST-C', active: true });
  const unitD = await unitRepo.save({ name: 'Unidade Teste D', code: 'TEST-D', active: true });
  const unitE = await unitRepo.save({ name: 'Unidade Teste E', code: 'TEST-E', active: true });

  const passwordHash = await argon2.hash(TEST_FIXTURE.password);
  await userRepo.save([
    {
      name: 'Officer Test',
      email: TEST_FIXTURE.officerEmail,
      passwordHash,
      role: officerRole,
      units: [unitA],
      active: true,
    },
    {
      name: 'Supervisor Test',
      email: TEST_FIXTURE.supervisorEmail,
      passwordHash,
      role: supervisorRole,
      units: [unitA],
      active: true,
    },
    {
      name: 'Warden Test',
      email: TEST_FIXTURE.wardenEmail,
      passwordHash,
      role: wardenRole,
      units: [unitA, unitC, unitD, unitE],
      active: true,
    },
  ]);

  // 'Pátio' não é usado aqui de propósito — é uma Rotina (galeria inteira), não
  // um MovementType individual (research.md #26).
  const [
    temporaryMovementType,
    permanentMovementType,
    ankleMonitorMovementType,
    transferMovementType,
    cellChangeMovementType,
    cellSwapMovementType,
    galleryChangeMovementType,
    gallerySwapMovementType,
  ] = await movementTypeRepo.save([
    { name: 'Atendimento médico interno', category: MovementCategory.TEMPORARY },
    { name: 'Liberdade', category: MovementCategory.PERMANENT },
    { name: 'Tornozeleira eletrônica', category: MovementCategory.PERMANENT },
    { name: 'Transferência', category: MovementCategory.PERMANENT },
    { name: 'Troca de cela', category: MovementCategory.PERMANENT },
    { name: 'Permuta de cela', category: MovementCategory.PERMANENT },
    { name: 'Troca de galeria', category: MovementCategory.PERMANENT },
    { name: 'Permuta de galeria', category: MovementCategory.PERMANENT },
    { name: 'Reversão de situação definitiva', category: MovementCategory.PERMANENT },
  ]);
  if (
    temporaryMovementType.id !== TEST_FIXTURE.temporaryMovementTypeId ||
    permanentMovementType.id !== TEST_FIXTURE.permanentMovementTypeId ||
    ankleMonitorMovementType.id !== TEST_FIXTURE.ankleMonitorMovementTypeId ||
    transferMovementType.id !== TEST_FIXTURE.transferMovementTypeId ||
    cellChangeMovementType.id !== TEST_FIXTURE.cellChangeMovementTypeId ||
    cellSwapMovementType.id !== TEST_FIXTURE.cellSwapMovementTypeId ||
    galleryChangeMovementType.id !== TEST_FIXTURE.galleryChangeMovementTypeId ||
    gallerySwapMovementType.id !== TEST_FIXTURE.gallerySwapMovementTypeId
  ) {
    throw new Error(
      `Movement type ids drifted from fixtures.ts (got temporary=${temporaryMovementType.id}, permanent=${permanentMovementType.id}, ankleMonitor=${ankleMonitorMovementType.id}, transfer=${transferMovementType.id}, cellChange=${cellChangeMovementType.id}, cellSwap=${cellSwapMovementType.id}, galleryChange=${galleryChangeMovementType.id}, gallerySwap=${gallerySwapMovementType.id}) — update TEST_FIXTURE to match.`,
    );
  }

  // eslint-disable-next-line no-console
  console.log(
    `Test DB "${TEST_DB_NAME}" ready — unitA=${unitA.id}, unitB=${unitB.id}, unitC=${unitC.id}, unitD=${unitD.id}, unitE=${unitE.id}`,
  );
  await AppDataSource.destroy();
}

main().catch((error: unknown) => {
  // eslint-disable-next-line no-console
  console.error('Integration test DB setup failed:', error);
  process.exit(1);
});
