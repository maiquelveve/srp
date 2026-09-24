import { MigrationInterface, QueryRunner } from 'typeorm';

/** Horas extras não tinham uso (a carga horária já é do dia): remove `staff_schedules.overtime_hours`. */
export class RemoveScheduleOvertimeHours1790100000000 implements MigrationInterface {
  name = 'RemoveScheduleOvertimeHours1790100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "staff_schedules" DROP COLUMN "overtime_hours"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "staff_schedules" ADD "overtime_hours" numeric(5,2) NOT NULL DEFAULT '0'`,
    );
  }
}
