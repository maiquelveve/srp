import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRoutineDateOverrides1788700831401 implements MigrationInterface {
  name = 'AddRoutineDateOverrides1788700831401';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_a1f3f6b3b1e8c5d2f9a6b4c7e0"`);
    await queryRunner.query(
      `CREATE TABLE "routine_date_overrides" ("id" SERIAL NOT NULL, "date" date NOT NULL, "active" boolean NOT NULL, "routine_id" integer NOT NULL, "updated_by" integer, CONSTRAINT "PK_5f80905166ecb35ee3b0a01cf68" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_fff5b8d6806320ccc554f1c6d0" ON "routine_date_overrides" ("routine_id", "date") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_e87001371959e16c8a77d856fa" ON "movements" ("paired_movement_id") WHERE paired_movement_id IS NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "routine_date_overrides" ADD CONSTRAINT "FK_5c94a1a620a8efca5a362fd82c5" FOREIGN KEY ("routine_id") REFERENCES "routines"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "routine_date_overrides" ADD CONSTRAINT "FK_1d8244a6930838681e75bf8153d" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "routine_date_overrides" DROP CONSTRAINT "FK_1d8244a6930838681e75bf8153d"`,
    );
    await queryRunner.query(
      `ALTER TABLE "routine_date_overrides" DROP CONSTRAINT "FK_5c94a1a620a8efca5a362fd82c5"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_e87001371959e16c8a77d856fa"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_fff5b8d6806320ccc554f1c6d0"`);
    await queryRunner.query(`DROP TABLE "routine_date_overrides"`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_a1f3f6b3b1e8c5d2f9a6b4c7e0" ON "movements" ("paired_movement_id") WHERE (paired_movement_id IS NOT NULL)`,
    );
  }
}
