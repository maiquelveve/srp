import { MigrationInterface, QueryRunner } from 'typeorm';

export class RequireMovementDestinationLocation1786905790306 implements MigrationInterface {
  name = 'RequireMovementDestinationLocation1786905790306';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Backfill pre-existing rows created while the column was still optional
    // (e.g. test/dev data from before research.md #26) — no real placeholder
    // value exists for old data, "Não informado" documents that it's a gap
    // instead of silently inventing a destination.
    await queryRunner.query(
      `UPDATE "movements" SET "destination_location" = 'Não informado' WHERE "destination_location" IS NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "movements" ALTER COLUMN "destination_location" SET NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "movements" ALTER COLUMN "destination_location" DROP NOT NULL`,
    );
  }
}
