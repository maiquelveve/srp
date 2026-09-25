import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Dado de referência, sem mudança de schema (FR-016a): tipo de movimentação
 * usado pela reversão de liberdade/tornozeleira/transferência. Bancos já
 * populados não rodam o seed de novo, por isso entra como migration.
 * Idempotente: não duplica se o tipo já existir.
 */
export class AddReversalMovementType1790300000000 implements MigrationInterface {
  name = 'AddReversalMovementType1790300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO "movement_types" ("name", "category")
      SELECT 'Reversão de situação definitiva', 'PERMANENT'
      WHERE NOT EXISTS (
        SELECT 1 FROM "movement_types" WHERE "name" = 'Reversão de situação definitiva'
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM "movement_types" WHERE "name" = 'Reversão de situação definitiva'`,
    );
  }
}
