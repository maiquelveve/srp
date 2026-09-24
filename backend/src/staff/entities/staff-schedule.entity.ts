import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Unit } from '../../units/entities/unit.entity';
import { ServicePost } from '../../posts/entities/service-post.entity';

/** Só há dois turnos (FR-022): diurno e noturno. */
export enum Shift {
  DAY = 'DAY',
  NIGHT = 'NIGHT',
}

export enum AttendanceStatus {
  PRESENT = 'PRESENT',
  ABSENT = 'ABSENT',
}

@Entity('staff_schedules')
@Index(['user', 'date', 'shift'], { unique: true })
export class StaffSchedule {
  @PrimaryGeneratedColumn()
  id: number;

  /** The policial penal — a User with role=PRISON_OFFICER (research.md #15). */
  @ManyToOne(() => User, { nullable: false })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => Unit, { nullable: false })
  @JoinColumn({ name: 'unit_id' })
  unit: Unit;

  /** Posto onde o policial fica neste turno; pode mudar de um turno para o outro do mesmo dia. */
  @ManyToOne(() => ServicePost, { nullable: false })
  @JoinColumn({ name: 'post_id' })
  post: ServicePost;

  @Column({ type: 'date' })
  date: string;

  @Column({ type: 'varchar', length: 20 })
  shift: Shift;

  /**
   * Carga horária do policial no DIA (ex.: 24 h), não do turno: é igual em
   * todas as escalas dele na mesma data (validado no service).
   */
  @Column({ type: 'int' })
  workloadHours: number;

  @Column({ type: 'varchar', length: 20, nullable: true })
  attendanceStatus: AttendanceStatus | null;

  @Column({ type: 'text', nullable: true })
  absenceReason: string | null;
}
