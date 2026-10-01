import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Biblioteca de documentos (data-model.md, FR-009…FR-014, FR-010a) — cria
 * `document_types` (+ seed das 3 categorias fixas, sem endpoint de criar/
 * editar/remover) e `documents` (constraint única composta
 * `(document_type_id, name)`, research.md #9).
 */
export class AddDocumentsTables1790866924889 implements MigrationInterface {
  name = 'AddDocumentsTables1790866924889';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "document_types" ("id" SERIAL NOT NULL, "code" character varying(20) NOT NULL, "label" character varying(50) NOT NULL, CONSTRAINT "UQ_5c46cecbae576329e689110cbb5" UNIQUE ("code"), CONSTRAINT "PK_d467d7eeb7c8ce216e90e8494aa" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "documents" ("id" SERIAL NOT NULL, "name" character varying(200) NOT NULL, "path" character varying(500) NOT NULL, "original_file_name" character varying(255) NOT NULL, "mime_type" character varying(100) NOT NULL, "size_bytes" integer NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "document_type_id" integer NOT NULL, "uploaded_by_user_id" integer NOT NULL, CONSTRAINT "PK_ac51aa5181ee2036f5ca482857c" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_4ecab0ec9bcf1e394efc10603c" ON "documents" ("document_type_id", "name") `,
    );
    await queryRunner.query(
      `ALTER TABLE "documents" ADD CONSTRAINT "FK_5e174bbf5fb523874f836c425e9" FOREIGN KEY ("document_type_id") REFERENCES "document_types"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "documents" ADD CONSTRAINT "FK_6f8986d1406171fccbd6bb2d864" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );

    // Seed das 3 categorias fixas (FR-009) — lista fechada, sem endpoint de criar/editar/remover.
    await queryRunner.query(`
      INSERT INTO "document_types" ("code", "label") VALUES
        ('FORM', 'Formulários'),
        ('TEMPLATE', 'Modelos de Documentos'),
        ('MANUAL', 'Manuais')
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "documents" DROP CONSTRAINT "FK_6f8986d1406171fccbd6bb2d864"`,
    );
    await queryRunner.query(
      `ALTER TABLE "documents" DROP CONSTRAINT "FK_5e174bbf5fb523874f836c425e9"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_4ecab0ec9bcf1e394efc10603c"`);
    await queryRunner.query(`DROP TABLE "documents"`);
    await queryRunner.query(`DROP TABLE "document_types"`);
  }
}
