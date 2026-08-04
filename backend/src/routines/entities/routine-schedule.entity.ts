import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Routine } from './routine.entity';

@Entity('routine_schedules')
@Index(['routine', 'weekday', 'time'], { unique: true })
export class RoutineSchedule {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Routine, (routine) => routine.schedules, { nullable: false })
  @JoinColumn({ name: 'routine_id' })
  routine: Routine;

  /** 0-6, null = every day. */
  @Column({ type: 'int', nullable: true })
  weekday: number | null;

  @Column({ type: 'time' })
  time: string;

  @Column({ type: 'boolean', default: true })
  active: boolean;
}
