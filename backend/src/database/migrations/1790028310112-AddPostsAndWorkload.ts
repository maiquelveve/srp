import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Postos de serviço, carga horária do dia e turnos DIURNO/NOTURNO (FR-022, FR-022a, FR-022b).
 *
 * Preserva os dados já cadastrados com o modelo anterior (setor em texto livre e três turnos):
 * - cada `sector` distinto (por unidade) vira um posto com o mesmo nome; escalas sem setor
 *   caem no posto "Não informado";
 * - MORNING e AFTERNOON viram DAY, NIGHT continua NIGHT. Se isso colidir com a unicidade
 *   (mesmo policial em manhã e tarde do mesmo dia; mesmo posto com mínimos de manhã e de
 *   tarde), fica uma linha só: a de menor id nas escalas, o maior mínimo na configuração;
 * - escalas antigas não tinham carga horária: recebem 12 h (a duração de cada um dos dois
 *   turnos), que é o valor menos arbitrário disponível.
 * O `down` restaura a estrutura antiga, mas não recupera a distinção manhã/tarde.
 */
export class AddPostsAndWorkload1790028310112 implements MigrationInterface {
  name = 'AddPostsAndWorkload1790028310112';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "posts" ("id" SERIAL NOT NULL, "name" character varying(100) NOT NULL, "active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "unit_id" integer NOT NULL, CONSTRAINT "PK_2829ac61eff60fcec60d7274b9e" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_9cfd5a2a33e7f304a7ed645e11" ON "posts" ("unit_id", "name") `,
    );
    await queryRunner.query(
      `ALTER TABLE "posts" ADD CONSTRAINT "FK_d6093748393b6e5e47dcfcc9ad9" FOREIGN KEY ("unit_id") REFERENCES "units"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );

    // Setores antigos -> postos.
    await queryRunner.query(
      `UPDATE "staff_schedules" SET "sector" = 'Não informado' WHERE "sector" IS NULL`,
    );
    await queryRunner.query(
      `INSERT INTO "posts" ("unit_id", "name")
       SELECT DISTINCT "unit_id", "sector" FROM (
         SELECT "unit_id", "sector" FROM "staff_schedules"
         UNION
         SELECT "unit_id", "sector" FROM "minimum_staffing_config"
       ) AS legacy_sectors`,
    );

    // Três turnos -> dois, sem violar as unicidades.
    await queryRunner.query(
      `DELETE FROM "staff_schedules" AS later USING "staff_schedules" AS earlier
       WHERE later."user_id" = earlier."user_id" AND later."date" = earlier."date"
         AND later."id" > earlier."id"
         AND (CASE WHEN later."shift" = 'NIGHT' THEN 'NIGHT' ELSE 'DAY' END)
           = (CASE WHEN earlier."shift" = 'NIGHT' THEN 'NIGHT' ELSE 'DAY' END)`,
    );
    await queryRunner.query(
      `UPDATE "staff_schedules" SET "shift" = 'DAY' WHERE "shift" <> 'NIGHT'`,
    );
    await queryRunner.query(
      `DELETE FROM "minimum_staffing_config" AS loser USING "minimum_staffing_config" AS winner
       WHERE loser."unit_id" = winner."unit_id" AND loser."sector" = winner."sector"
         AND loser."id" <> winner."id"
         AND (CASE WHEN loser."shift" = 'NIGHT' THEN 'NIGHT' ELSE 'DAY' END)
           = (CASE WHEN winner."shift" = 'NIGHT' THEN 'NIGHT' ELSE 'DAY' END)
         AND (winner."minimum_headcount" > loser."minimum_headcount"
           OR (winner."minimum_headcount" = loser."minimum_headcount" AND winner."id" < loser."id"))`,
    );
    await queryRunner.query(
      `UPDATE "minimum_staffing_config" SET "shift" = 'DAY' WHERE "shift" <> 'NIGHT'`,
    );

    // staff_schedules: post_id + workload_hours no lugar de sector + gallery_id.
    await queryRunner.query(`ALTER TABLE "staff_schedules" ADD "post_id" integer`);
    await queryRunner.query(
      `UPDATE "staff_schedules" AS schedule SET "post_id" = post."id"
       FROM "posts" AS post WHERE post."unit_id" = schedule."unit_id" AND post."name" = schedule."sector"`,
    );
    await queryRunner.query(`ALTER TABLE "staff_schedules" ALTER COLUMN "post_id" SET NOT NULL`);
    await queryRunner.query(
      `ALTER TABLE "staff_schedules" ADD "workload_hours" integer NOT NULL DEFAULT 12`,
    );
    await queryRunner.query(
      `ALTER TABLE "staff_schedules" ALTER COLUMN "workload_hours" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "staff_schedules" DROP CONSTRAINT "FK_474dccfd47efb687c87a8165211"`,
    );
    await queryRunner.query(`ALTER TABLE "staff_schedules" DROP COLUMN "gallery_id"`);
    await queryRunner.query(`ALTER TABLE "staff_schedules" DROP COLUMN "sector"`);
    await queryRunner.query(
      `ALTER TABLE "staff_schedules" ADD CONSTRAINT "FK_5f7c7df9cb74f5a89231265c9a6" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );

    // minimum_staffing_config: post_id no lugar de unit_id + sector.
    await queryRunner.query(`ALTER TABLE "minimum_staffing_config" ADD "post_id" integer`);
    await queryRunner.query(
      `UPDATE "minimum_staffing_config" AS config SET "post_id" = post."id"
       FROM "posts" AS post WHERE post."unit_id" = config."unit_id" AND post."name" = config."sector"`,
    );
    await queryRunner.query(
      `ALTER TABLE "minimum_staffing_config" ALTER COLUMN "post_id" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "minimum_staffing_config" DROP CONSTRAINT "FK_11ea829bd3c411dd35b639ee4bd"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_a2e7cb656ac467307f06674ac3"`);
    await queryRunner.query(`ALTER TABLE "minimum_staffing_config" DROP COLUMN "unit_id"`);
    await queryRunner.query(`ALTER TABLE "minimum_staffing_config" DROP COLUMN "sector"`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_59870295b81ff0dc81dd79772f" ON "minimum_staffing_config" ("post_id", "shift") `,
    );
    await queryRunner.query(
      `ALTER TABLE "minimum_staffing_config" ADD CONSTRAINT "FK_74645fa1c2a600c77e62817553b" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // minimum_staffing_config
    await queryRunner.query(
      `ALTER TABLE "minimum_staffing_config" DROP CONSTRAINT "FK_74645fa1c2a600c77e62817553b"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_59870295b81ff0dc81dd79772f"`);
    await queryRunner.query(
      `ALTER TABLE "minimum_staffing_config" ADD "sector" character varying(100)`,
    );
    await queryRunner.query(`ALTER TABLE "minimum_staffing_config" ADD "unit_id" integer`);
    await queryRunner.query(
      `UPDATE "minimum_staffing_config" AS config SET "sector" = post."name", "unit_id" = post."unit_id"
       FROM "posts" AS post WHERE post."id" = config."post_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "minimum_staffing_config" ALTER COLUMN "sector" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "minimum_staffing_config" ALTER COLUMN "unit_id" SET NOT NULL`,
    );
    await queryRunner.query(`ALTER TABLE "minimum_staffing_config" DROP COLUMN "post_id"`);
    await queryRunner.query(
      `UPDATE "minimum_staffing_config" SET "shift" = 'MORNING' WHERE "shift" = 'DAY'`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_a2e7cb656ac467307f06674ac3" ON "minimum_staffing_config" ("sector", "shift", "unit_id") `,
    );
    await queryRunner.query(
      `ALTER TABLE "minimum_staffing_config" ADD CONSTRAINT "FK_11ea829bd3c411dd35b639ee4bd" FOREIGN KEY ("unit_id") REFERENCES "units"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );

    // staff_schedules
    await queryRunner.query(
      `ALTER TABLE "staff_schedules" DROP CONSTRAINT "FK_5f7c7df9cb74f5a89231265c9a6"`,
    );
    await queryRunner.query(`ALTER TABLE "staff_schedules" ADD "sector" character varying(100)`);
    await queryRunner.query(`ALTER TABLE "staff_schedules" ADD "gallery_id" integer`);
    await queryRunner.query(
      `UPDATE "staff_schedules" AS schedule SET "sector" = post."name"
       FROM "posts" AS post WHERE post."id" = schedule."post_id"`,
    );
    await queryRunner.query(`ALTER TABLE "staff_schedules" DROP COLUMN "post_id"`);
    await queryRunner.query(`ALTER TABLE "staff_schedules" DROP COLUMN "workload_hours"`);
    await queryRunner.query(
      `UPDATE "staff_schedules" SET "shift" = 'MORNING' WHERE "shift" = 'DAY'`,
    );
    await queryRunner.query(
      `ALTER TABLE "staff_schedules" ADD CONSTRAINT "FK_474dccfd47efb687c87a8165211" FOREIGN KEY ("gallery_id") REFERENCES "galleries"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );

    await queryRunner.query(`ALTER TABLE "posts" DROP CONSTRAINT "FK_d6093748393b6e5e47dcfcc9ad9"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_9cfd5a2a33e7f304a7ed645e11"`);
    await queryRunner.query(`DROP TABLE "posts"`);
  }
}
