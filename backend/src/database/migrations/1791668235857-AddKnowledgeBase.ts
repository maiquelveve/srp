import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Base de conhecimento com RAG (data-model.md, feature 003): documentos,
 * trechos com embedding (pgvector) e histórico de consultas imutável.
 *
 * Gerada pelo TypeORM e complementada à mão com o que ele não descreve:
 * extensão `vector`, índice HNSW da busca por similaridade e a trigger que
 * torna `knowledge_queries` imutável (mesmo molde de MakeAuditLogsImmutable).
 */
export class AddKnowledgeBase1791668235857 implements MigrationInterface {
  name = 'AddKnowledgeBase1791668235857';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Precisa existir antes de criar a coluna `vector(1024)`.
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS vector`);
    await queryRunner.query(
      `CREATE TABLE "knowledge_documents" ("id" SERIAL NOT NULL, "name" character varying(200) NOT NULL, "file_path" character varying(500) NOT NULL, "pending_file_path" character varying(500), "original_file_name" character varying(255) NOT NULL, "file_format" character varying(10) NOT NULL, "size_bytes" integer NOT NULL, "status" character varying(20) NOT NULL, "failure_reason" character varying(40), "chunk_count" integer NOT NULL DEFAULT '0', "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "uploaded_by_user_id" integer NOT NULL, CONSTRAINT "PK_402a3c43fb263aa5289670e4e21" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_7a4f99df331aff3e1d529f71b3" ON "knowledge_documents" ("name") `,
    );
    await queryRunner.query(
      `CREATE TABLE "knowledge_document_chunks" ("id" SERIAL NOT NULL, "position" integer NOT NULL, "content" text NOT NULL, "word_count" integer NOT NULL, "embedding" vector(1024) NOT NULL, "embedding_model" character varying(100) NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "document_id" integer NOT NULL, CONSTRAINT "PK_0f4c5cd2867059c66f7734407a8" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_5266f0d63c30e248a1e016d3e7" ON "knowledge_document_chunks" ("document_id", "position") `,
    );
    await queryRunner.query(
      `CREATE TABLE "knowledge_queries" ("id" SERIAL NOT NULL, "question" text NOT NULL, "answer" text NOT NULL, "outcome" character varying(20) NOT NULL, "sources" jsonb NOT NULL DEFAULT '[]', "failure_kind" character varying(30), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "user_id" integer NOT NULL, CONSTRAINT "PK_80c90514c2d9a34d1c60ac1d7b8" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_knowledge_queries_user_created_at" ON "knowledge_queries" ("user_id", "created_at") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_knowledge_queries_created_at" ON "knowledge_queries" ("created_at") `,
    );
    await queryRunner.query(
      `ALTER TABLE "knowledge_documents" ADD CONSTRAINT "FK_54447f2ba803ada925af7ba8649" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "knowledge_document_chunks" ADD CONSTRAINT "FK_261072bcd0855c3fa32e81ea286" FOREIGN KEY ("document_id") REFERENCES "knowledge_documents"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "knowledge_queries" ADD CONSTRAINT "FK_c9b6e3d57b1edf88c8c1222974a" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );

    // Índice da busca por similaridade: distância de cosseno (operador <=>).
    await queryRunner.query(
      `CREATE INDEX "IDX_knowledge_document_chunks_embedding" ON "knowledge_document_chunks" USING hnsw ("embedding" vector_cosine_ops)`,
    );

    // Histórico imutável (FR-024): UPDATE, DELETE e TRUNCATE falham, inclusive para o dono da tabela.
    await queryRunner.query(`
            CREATE FUNCTION "knowledge_queries_block_change"() RETURNS trigger
            LANGUAGE plpgsql AS $$
            BEGIN
                RAISE EXCEPTION 'knowledge_queries is immutable: % is not allowed', TG_OP
                    USING ERRCODE = 'restrict_violation';
            END;
            $$
        `);
    await queryRunner.query(`
            CREATE TRIGGER "knowledge_queries_immutable"
            BEFORE UPDATE OR DELETE OR TRUNCATE ON "knowledge_queries"
            FOR EACH STATEMENT EXECUTE FUNCTION "knowledge_queries_block_change"()
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TRIGGER "knowledge_queries_immutable" ON "knowledge_queries"`);
    await queryRunner.query(`DROP FUNCTION "knowledge_queries_block_change"()`);
    await queryRunner.query(`DROP INDEX "public"."IDX_knowledge_document_chunks_embedding"`);
    await queryRunner.query(
      `ALTER TABLE "knowledge_queries" DROP CONSTRAINT "FK_c9b6e3d57b1edf88c8c1222974a"`,
    );
    await queryRunner.query(
      `ALTER TABLE "knowledge_document_chunks" DROP CONSTRAINT "FK_261072bcd0855c3fa32e81ea286"`,
    );
    await queryRunner.query(
      `ALTER TABLE "knowledge_documents" DROP CONSTRAINT "FK_54447f2ba803ada925af7ba8649"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_knowledge_queries_created_at"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_knowledge_queries_user_created_at"`);
    await queryRunner.query(`DROP TABLE "knowledge_queries"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_5266f0d63c30e248a1e016d3e7"`);
    await queryRunner.query(`DROP TABLE "knowledge_document_chunks"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_7a4f99df331aff3e1d529f71b3"`);
    await queryRunner.query(`DROP TABLE "knowledge_documents"`);
    // A extensão `vector` fica instalada de propósito: outras features podem passar a usá-la.
  }
}
