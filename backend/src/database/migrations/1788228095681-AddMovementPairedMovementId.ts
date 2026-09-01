import { MigrationInterface, QueryRunner } from 'typeorm';

/** research.md #35 — links the two Movement rows created by a permuta (cell-swap/gallery-swap). */
export class AddMovementPairedMovementId1788228095681 implements MigrationInterface {
  name = 'AddMovementPairedMovementId1788228095681';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "movements" ADD "paired_movement_id" integer`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_a1f3f6b3b1e8c5d2f9a6b4c7e0" ON "movements" ("paired_movement_id") WHERE paired_movement_id IS NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_a1f3f6b3b1e8c5d2f9a6b4c7e0"`);
    await queryRunner.query(`ALTER TABLE "movements" DROP COLUMN "paired_movement_id"`);
  }
}
