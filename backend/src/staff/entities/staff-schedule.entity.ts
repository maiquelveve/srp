import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Unit } from '../../units/entities/unit.entity';
import { Gallery } from '../../galleries/entities/gallery.entity';

export enum Shift {
  MORNING = 'MORNING',
  AFTERNOON = 'AFTERNOON',
  NIGHT = 'NIGHT',
}

export enum AttendanceStatus {
  PRESENT = 'PRESENT',
  ABSENT = 'ABSENT',
  EXCUSED = 'EXCUSED',
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

  @ManyToOne(() => Gallery, { nullable: true })
  @JoinColumn({ name: 'gallery_id' })
  gallery: Gallery | null;

  @Column({ type: 'date' })
  date: string;

  @Column({ type: 'varchar', length: 20 })
  shift: Shift;

  @Column({ type: 'varchar', length: 100, nullable: true })
  sector: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  attendanceStatus: AttendanceStatus | null;

  @Column({ type: 'text', nullable: true })
  absenceReason: string | null;

  @Column({ type: 'numeric', precision: 5, scale: 2, default: 0 })
  overtimeHours: number;
}
