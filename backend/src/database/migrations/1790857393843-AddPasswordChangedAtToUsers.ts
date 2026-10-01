import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * `User.passwordChangedAt` — usado por `JwtStrategy` pra rejeitar, na
 * próxima requisição, um access token ainda válido mas emitido ANTES da
 * última troca/reset de senha (FR-017a/FR-007). Sem isso, revogar só o
 * refresh token deixa outras sessões abertas funcionando até o access
 * token expirar sozinho (15 min por padrão).
 */
export class AddPasswordChangedAtToUsers1790857393843 implements MigrationInterface {
  name = 'AddPasswordChangedAtToUsers1790857393843';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD "password_changed_at" TIMESTAMP WITH TIME ZONE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "password_changed_at"`);
  }
}
