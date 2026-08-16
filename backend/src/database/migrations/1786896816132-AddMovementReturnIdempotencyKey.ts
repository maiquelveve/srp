import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMovementReturnIdempotencyKey1786896816132 implements MigrationInterface {
  name = 'AddMovementReturnIdempotencyKey1786896816132';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "movements" ADD "return_idempotency_key" uuid`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_9c03e883eff1a6864a78a2d2df" ON "movements" ("return_idempotency_key") WHERE return_idempotency_key IS NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_9c03e883eff1a6864a78a2d2df"`);
    await queryRunner.query(`ALTER TABLE "movements" DROP COLUMN "return_idempotency_key"`);
  }
}
