import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Guarda o nome original do arquivo da nova versão enquanto o documento está
 * em UPDATING. Sem isso, só seria possível trocar o nome exibido quando a
 * atualização termina se ele fosse inventado a partir do nome gerado (UUID).
 */
export class AddPendingOriginalFileNameToKnowledgeDocuments1791700000000 implements MigrationInterface {
  name = 'AddPendingOriginalFileNameToKnowledgeDocuments1791700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "knowledge_documents" ADD "pending_original_file_name" character varying(255)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "knowledge_documents" DROP COLUMN "pending_original_file_name"`,
    );
  }
}
