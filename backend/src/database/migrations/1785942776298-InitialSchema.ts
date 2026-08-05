import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1785942776298 implements MigrationInterface {
  name = 'InitialSchema1785942776298';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "inmate_cell_history" ("id" SERIAL NOT NULL, "entry_date" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "exit_date" TIMESTAMP WITH TIME ZONE, "reason" character varying(100), "inmate_id" integer NOT NULL, "cell_id" integer NOT NULL, "user_id" integer, CONSTRAINT "PK_f4a91766c1830ef1c6bdf84fb8c" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "inmates" ("id" SERIAL NOT NULL, "name" character varying(200) NOT NULL, "registration_id" character varying(50), "birth_date" date, "custody_regime" character varying(50), "photo_url" text, "status" character varying(50) NOT NULL DEFAULT 'ACTIVE', "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "current_cell_id" integer NOT NULL, CONSTRAINT "UQ_f3a424f122fcc3c05d9451f466d" UNIQUE ("registration_id"), CONSTRAINT "PK_ec30c7e9b407a24c84a7f0e0449" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "cells" ("id" SERIAL NOT NULL, "code" character varying(20) NOT NULL, "capacity" integer NOT NULL DEFAULT '0', "type" character varying(50), "active" boolean NOT NULL DEFAULT true, "gallery_id" integer NOT NULL, CONSTRAINT "PK_b9443df02c1a41bc03f264388c8" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_14194481a5fa9d7537dd08bf93" ON "cells" ("gallery_id", "code") `,
    );
    await queryRunner.query(
      `CREATE TABLE "galleries" ("id" SERIAL NOT NULL, "code" character varying(50) NOT NULL, "description" text, "type" character varying(50), "active" boolean NOT NULL DEFAULT true, "unit_id" integer NOT NULL, CONSTRAINT "PK_86b77299615c92db3d68c9c7919" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_27ba21cf54aa12d4765dd8f902" ON "galleries" ("unit_id", "code") `,
    );
    await queryRunner.query(
      `CREATE TABLE "units" ("id" SERIAL NOT NULL, "name" character varying(150) NOT NULL, "code" character varying(20), "address" text, "phone" character varying(50), "active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_47635c1ab22d02fc3ebae3608b8" UNIQUE ("code"), CONSTRAINT "PK_5a8f2f064919b587d93936cb223" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "refresh_tokens" ("id" SERIAL NOT NULL, "token_hash" character varying(255) NOT NULL, "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, "revoked_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "user_id" integer NOT NULL, CONSTRAINT "PK_7d8bee0204106019488c4c50ffa" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_a7838d2ba25be1342091b6695f" ON "refresh_tokens" ("token_hash") `,
    );
    await queryRunner.query(
      `CREATE TABLE "users" ("id" SERIAL NOT NULL, "name" character varying(150) NOT NULL, "email" character varying(150) NOT NULL, "password_hash" character varying(255) NOT NULL, "badge_number" character varying(50), "job_title" character varying(100), "active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "role_id" integer NOT NULL, CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"), CONSTRAINT "UQ_7d797283ff17a9d930aa2ffa912" UNIQUE ("badge_number"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "roles" ("id" SERIAL NOT NULL, "name" character varying(50) NOT NULL, "description" text, CONSTRAINT "UQ_648e3f5447f725579d7d4ffdfb7" UNIQUE ("name"), CONSTRAINT "PK_c1433d71a4838793a49dcad46ab" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "invite_tokens" ("id" SERIAL NOT NULL, "token_hash" character varying(255) NOT NULL, "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, "used_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "user_id" integer NOT NULL, CONSTRAINT "PK_5a05a43816424a1abac69e1f8a5" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_b728a0bd605dc34a9a5ef7fba2" ON "invite_tokens" ("token_hash") `,
    );
    await queryRunner.query(
      `CREATE TABLE "movement_types" ("id" SERIAL NOT NULL, "name" character varying(100) NOT NULL, "category" character varying(50) NOT NULL, "description" text, CONSTRAINT "UQ_46a9c51e59998776a956ca02602" UNIQUE ("name"), CONSTRAINT "PK_157378727fd686272582297d37f" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "movements" ("id" SERIAL NOT NULL, "destination_location" text, "reason" text, "exit_datetime" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "return_datetime" TIMESTAMP WITH TIME ZONE, "notes" text, "idempotency_key" uuid, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "inmate_id" integer NOT NULL, "movement_type_id" integer NOT NULL, "origin_cell_id" integer NOT NULL, "destination_cell_id" integer, "user_id" integer NOT NULL, CONSTRAINT "PK_5a8e3da15ab8f2ce353e7f58f67" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_3357d06cc97a27a454e4154f2d" ON "movements" ("idempotency_key") WHERE idempotency_key IS NOT NULL`,
    );
    await queryRunner.query(
      `CREATE TABLE "routine_schedules" ("id" SERIAL NOT NULL, "weekday" integer, "time" TIME NOT NULL, "active" boolean NOT NULL DEFAULT true, "routine_id" integer NOT NULL, CONSTRAINT "PK_89f20df9a9912de74acb4d494e2" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_f1340ac97fdd9d1ee55b973d1f" ON "routine_schedules" ("routine_id", "weekday", "time") `,
    );
    await queryRunner.query(
      `CREATE TABLE "routines" ("id" SERIAL NOT NULL, "name" character varying(100) NOT NULL, "type" character varying(50) NOT NULL, "description" text, "active" boolean NOT NULL DEFAULT true, "locked" boolean NOT NULL DEFAULT false, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "gallery_id" integer NOT NULL, "created_by" integer, CONSTRAINT "PK_6847e8f0f74e65a6f10409dee9f" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "staff_schedules" ("id" SERIAL NOT NULL, "date" date NOT NULL, "shift" character varying(20) NOT NULL, "sector" character varying(100), "attendance_status" character varying(20), "absence_reason" text, "overtime_hours" numeric(5,2) NOT NULL DEFAULT '0', "user_id" integer NOT NULL, "unit_id" integer NOT NULL, "gallery_id" integer, CONSTRAINT "PK_6484157e0a3264994b8572183ef" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_f9773f0066f20d8d120f5f855c" ON "staff_schedules" ("user_id", "date", "shift") `,
    );
    await queryRunner.query(
      `CREATE TABLE "minimum_staffing_config" ("id" SERIAL NOT NULL, "sector" character varying(100) NOT NULL, "shift" character varying(20) NOT NULL, "minimum_headcount" integer NOT NULL, "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "unit_id" integer NOT NULL, "updated_by" integer, CONSTRAINT "PK_221e8c9ec051c9225d68a3fd518" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_a2e7cb656ac467307f06674ac3" ON "minimum_staffing_config" ("unit_id", "sector", "shift") `,
    );
    await queryRunner.query(
      `CREATE TABLE "audit_logs" ("id" SERIAL NOT NULL, "affected_table" character varying(50), "record_id" integer, "action" character varying(20) NOT NULL, "old_data" jsonb, "new_data" jsonb, "timestamp" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "user_id" integer, CONSTRAINT "PK_1bb179d048bbc581caa3b013439" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_f6b20be64a5c87c4c5bcd27eaa" ON "audit_logs" ("affected_table") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_88dcc148d532384790ab874c3d" ON "audit_logs" ("timestamp") `,
    );
    await queryRunner.query(
      `CREATE TABLE "user_units" ("user_id" integer NOT NULL, "unit_id" integer NOT NULL, CONSTRAINT "PK_8686a6d3c428d29c9f68d532545" PRIMARY KEY ("user_id", "unit_id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_d3a73e254af5ee54e4e03ff2af" ON "user_units" ("user_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_396354fec885be8f598f4137d0" ON "user_units" ("unit_id") `,
    );
    await queryRunner.query(
      `ALTER TABLE "inmate_cell_history" ADD CONSTRAINT "FK_dc5276504423aaeacb7d5f82af3" FOREIGN KEY ("inmate_id") REFERENCES "inmates"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "inmate_cell_history" ADD CONSTRAINT "FK_77411c8cf667389a82792e5be24" FOREIGN KEY ("cell_id") REFERENCES "cells"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "inmate_cell_history" ADD CONSTRAINT "FK_ace4e1299344eb429d2061704da" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "inmates" ADD CONSTRAINT "FK_cfb2f1f49673fc8b102a6043c8e" FOREIGN KEY ("current_cell_id") REFERENCES "cells"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "cells" ADD CONSTRAINT "FK_450abb4cf06d097612e76bc981a" FOREIGN KEY ("gallery_id") REFERENCES "galleries"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "galleries" ADD CONSTRAINT "FK_a7f1f2be7fbd48e655c06fe7107" FOREIGN KEY ("unit_id") REFERENCES "units"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "refresh_tokens" ADD CONSTRAINT "FK_3ddc983c5f7bcf132fd8732c3f4" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD CONSTRAINT "FK_a2cecd1a3531c0b041e29ba46e1" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "invite_tokens" ADD CONSTRAINT "FK_e784f26221df4e5537b3ca7a4ce" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "movements" ADD CONSTRAINT "FK_8b4287b3a42470826d3de729b25" FOREIGN KEY ("inmate_id") REFERENCES "inmates"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "movements" ADD CONSTRAINT "FK_74d2aab6e0b34b5d0b13bee5cc9" FOREIGN KEY ("movement_type_id") REFERENCES "movement_types"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "movements" ADD CONSTRAINT "FK_900af2d1e9a5b9a67594c6579fe" FOREIGN KEY ("origin_cell_id") REFERENCES "cells"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "movements" ADD CONSTRAINT "FK_fdd5e7abca31fd034b67dd9565b" FOREIGN KEY ("destination_cell_id") REFERENCES "cells"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "movements" ADD CONSTRAINT "FK_79d4ab82c6a9c26ae193efae400" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "routine_schedules" ADD CONSTRAINT "FK_c0b9c20017f4f9f1719564cbd87" FOREIGN KEY ("routine_id") REFERENCES "routines"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "routines" ADD CONSTRAINT "FK_b14c2bbde718f51cd42097f6660" FOREIGN KEY ("gallery_id") REFERENCES "galleries"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "routines" ADD CONSTRAINT "FK_40c76b46288ee5865a16df50388" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "staff_schedules" ADD CONSTRAINT "FK_d630209d33108b76c7266013f56" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "staff_schedules" ADD CONSTRAINT "FK_52f16d13ce205777b28a834f997" FOREIGN KEY ("unit_id") REFERENCES "units"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "staff_schedules" ADD CONSTRAINT "FK_474dccfd47efb687c87a8165211" FOREIGN KEY ("gallery_id") REFERENCES "galleries"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "minimum_staffing_config" ADD CONSTRAINT "FK_11ea829bd3c411dd35b639ee4bd" FOREIGN KEY ("unit_id") REFERENCES "units"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "minimum_staffing_config" ADD CONSTRAINT "FK_3aa3391ea93cde1d33637d8e895" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "audit_logs" ADD CONSTRAINT "FK_bd2726fd31b35443f2245b93ba0" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_units" ADD CONSTRAINT "FK_d3a73e254af5ee54e4e03ff2afb" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_units" ADD CONSTRAINT "FK_396354fec885be8f598f4137d02" FOREIGN KEY ("unit_id") REFERENCES "units"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_units" DROP CONSTRAINT "FK_396354fec885be8f598f4137d02"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_units" DROP CONSTRAINT "FK_d3a73e254af5ee54e4e03ff2afb"`,
    );
    await queryRunner.query(
      `ALTER TABLE "audit_logs" DROP CONSTRAINT "FK_bd2726fd31b35443f2245b93ba0"`,
    );
    await queryRunner.query(
      `ALTER TABLE "minimum_staffing_config" DROP CONSTRAINT "FK_3aa3391ea93cde1d33637d8e895"`,
    );
    await queryRunner.query(
      `ALTER TABLE "minimum_staffing_config" DROP CONSTRAINT "FK_11ea829bd3c411dd35b639ee4bd"`,
    );
    await queryRunner.query(
      `ALTER TABLE "staff_schedules" DROP CONSTRAINT "FK_474dccfd47efb687c87a8165211"`,
    );
    await queryRunner.query(
      `ALTER TABLE "staff_schedules" DROP CONSTRAINT "FK_52f16d13ce205777b28a834f997"`,
    );
    await queryRunner.query(
      `ALTER TABLE "staff_schedules" DROP CONSTRAINT "FK_d630209d33108b76c7266013f56"`,
    );
    await queryRunner.query(
      `ALTER TABLE "routines" DROP CONSTRAINT "FK_40c76b46288ee5865a16df50388"`,
    );
    await queryRunner.query(
      `ALTER TABLE "routines" DROP CONSTRAINT "FK_b14c2bbde718f51cd42097f6660"`,
    );
    await queryRunner.query(
      `ALTER TABLE "routine_schedules" DROP CONSTRAINT "FK_c0b9c20017f4f9f1719564cbd87"`,
    );
    await queryRunner.query(
      `ALTER TABLE "movements" DROP CONSTRAINT "FK_79d4ab82c6a9c26ae193efae400"`,
    );
    await queryRunner.query(
      `ALTER TABLE "movements" DROP CONSTRAINT "FK_fdd5e7abca31fd034b67dd9565b"`,
    );
    await queryRunner.query(
      `ALTER TABLE "movements" DROP CONSTRAINT "FK_900af2d1e9a5b9a67594c6579fe"`,
    );
    await queryRunner.query(
      `ALTER TABLE "movements" DROP CONSTRAINT "FK_74d2aab6e0b34b5d0b13bee5cc9"`,
    );
    await queryRunner.query(
      `ALTER TABLE "movements" DROP CONSTRAINT "FK_8b4287b3a42470826d3de729b25"`,
    );
    await queryRunner.query(
      `ALTER TABLE "invite_tokens" DROP CONSTRAINT "FK_e784f26221df4e5537b3ca7a4ce"`,
    );
    await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT "FK_a2cecd1a3531c0b041e29ba46e1"`);
    await queryRunner.query(
      `ALTER TABLE "refresh_tokens" DROP CONSTRAINT "FK_3ddc983c5f7bcf132fd8732c3f4"`,
    );
    await queryRunner.query(
      `ALTER TABLE "galleries" DROP CONSTRAINT "FK_a7f1f2be7fbd48e655c06fe7107"`,
    );
    await queryRunner.query(`ALTER TABLE "cells" DROP CONSTRAINT "FK_450abb4cf06d097612e76bc981a"`);
    await queryRunner.query(
      `ALTER TABLE "inmates" DROP CONSTRAINT "FK_cfb2f1f49673fc8b102a6043c8e"`,
    );
    await queryRunner.query(
      `ALTER TABLE "inmate_cell_history" DROP CONSTRAINT "FK_ace4e1299344eb429d2061704da"`,
    );
    await queryRunner.query(
      `ALTER TABLE "inmate_cell_history" DROP CONSTRAINT "FK_77411c8cf667389a82792e5be24"`,
    );
    await queryRunner.query(
      `ALTER TABLE "inmate_cell_history" DROP CONSTRAINT "FK_dc5276504423aaeacb7d5f82af3"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_396354fec885be8f598f4137d0"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_d3a73e254af5ee54e4e03ff2af"`);
    await queryRunner.query(`DROP TABLE "user_units"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_88dcc148d532384790ab874c3d"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_f6b20be64a5c87c4c5bcd27eaa"`);
    await queryRunner.query(`DROP TABLE "audit_logs"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_a2e7cb656ac467307f06674ac3"`);
    await queryRunner.query(`DROP TABLE "minimum_staffing_config"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_f9773f0066f20d8d120f5f855c"`);
    await queryRunner.query(`DROP TABLE "staff_schedules"`);
    await queryRunner.query(`DROP TABLE "routines"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_f1340ac97fdd9d1ee55b973d1f"`);
    await queryRunner.query(`DROP TABLE "routine_schedules"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_3357d06cc97a27a454e4154f2d"`);
    await queryRunner.query(`DROP TABLE "movements"`);
    await queryRunner.query(`DROP TABLE "movement_types"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_b728a0bd605dc34a9a5ef7fba2"`);
    await queryRunner.query(`DROP TABLE "invite_tokens"`);
    await queryRunner.query(`DROP TABLE "roles"`);
    await queryRunner.query(`DROP TABLE "users"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_a7838d2ba25be1342091b6695f"`);
    await queryRunner.query(`DROP TABLE "refresh_tokens"`);
    await queryRunner.query(`DROP TABLE "units"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_27ba21cf54aa12d4765dd8f902"`);
    await queryRunner.query(`DROP TABLE "galleries"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_14194481a5fa9d7537dd08bf93"`);
    await queryRunner.query(`DROP TABLE "cells"`);
    await queryRunner.query(`DROP TABLE "inmates"`);
    await queryRunner.query(`DROP TABLE "inmate_cell_history"`);
  }
}
