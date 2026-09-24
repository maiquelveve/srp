import { MigrationInterface, QueryRunner } from 'typeorm';

/** Abono deixou de existir (só presença e falta): abonos já registrados viram falta. */
export class RemoveExcusedAttendance1790100000001 implements MigrationInterface {
  name = 'RemoveExcusedAttendance1790100000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "staff_schedules" SET "attendance_status" = 'ABSENT' WHERE "attendance_status" = 'EXCUSED'`,
    );
  }

  public async down(): Promise<void> {
    // Sem como distinguir quais faltas eram abonos.
  }
}
