import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Trava `audit_logs` no banco (Constitution III, FR-027, T105): qualquer
 * UPDATE, DELETE ou TRUNCATE falha, inclusive para o dono da tabela, o
 * usuário da aplicação e perfis administrativos. INSERT segue livre.
 *
 * Só quem pode alterar a tabela (dono ou superusuário) consegue desligar a
 * trigger (`ALTER TABLE ... DISABLE TRIGGER`), o que fica fora do alcance da
 * aplicação. Linhas já existentes não mudam; apenas deixam de poder mudar.
 */
export class MakeAuditLogsImmutable1790200000000 implements MigrationInterface {
  name = 'MakeAuditLogsImmutable1790200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE FUNCTION "audit_logs_block_change"() RETURNS trigger
      LANGUAGE plpgsql AS $$
      BEGIN
        RAISE EXCEPTION 'audit_logs is immutable: % is not allowed', TG_OP
          USING ERRCODE = 'restrict_violation';
      END;
      $$
    `);
    await queryRunner.query(`
      CREATE TRIGGER "audit_logs_immutable"
      BEFORE UPDATE OR DELETE OR TRUNCATE ON "audit_logs"
      FOR EACH STATEMENT EXECUTE FUNCTION "audit_logs_block_change"()
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TRIGGER "audit_logs_immutable" ON "audit_logs"`);
    await queryRunner.query(`DROP FUNCTION "audit_logs_block_change"()`);
  }
}
