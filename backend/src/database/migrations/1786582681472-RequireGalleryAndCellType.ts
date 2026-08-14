import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Galleries/Cells `type` becomes required (tasks.md T034h-type-enum
 * follow-up). Existing rows predating the `GalleryType`/`CellType` enums may
 * have NULL `type` — backfill those to the enum's first member before adding
 * the NOT NULL constraint, since altering the column would otherwise fail
 * against any existing NULL.
 */
export class RequireGalleryAndCellType1786582681472 implements MigrationInterface {
  name = 'RequireGalleryAndCellType1786582681472';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`UPDATE "galleries" SET "type" = 'MALE' WHERE "type" IS NULL`);
    await queryRunner.query(`ALTER TABLE "galleries" ALTER COLUMN "type" SET NOT NULL`);

    await queryRunner.query(`UPDATE "cells" SET "type" = 'SHARED' WHERE "type" IS NULL`);
    await queryRunner.query(`ALTER TABLE "cells" ALTER COLUMN "type" SET NOT NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "cells" ALTER COLUMN "type" DROP NOT NULL`);
    await queryRunner.query(`ALTER TABLE "galleries" ALTER COLUMN "type" DROP NOT NULL`);
  }
}
