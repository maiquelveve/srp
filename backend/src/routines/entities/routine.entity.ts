import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Gallery } from '../../galleries/entities/gallery.entity';
import { User } from '../../users/entities/user.entity';
import { RoutineSchedule } from './routine-schedule.entity';

export enum RoutineType {
  DAILY = 'DAILY',
  WEEKDAY = 'WEEKDAY',
  VISIT_DAY = 'VISIT_DAY',
  WEEKEND = 'WEEKEND',
  HOLIDAY = 'HOLIDAY',
}

@Entity('routines')
export class Routine {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'varchar', length: 50 })
  type: RoutineType;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @ManyToOne(() => Gallery, { nullable: false })
  @JoinColumn({ name: 'gallery_id' })
  gallery: Gallery;

  @Column({ type: 'boolean', default: true })
  active: boolean;

  /** true = padrão definido pela Chefia/Diretor, não editável por Supervisor (FR-018/FR-019). */
  @Column({ type: 'boolean', default: false })
  locked: boolean;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'created_by' })
  createdBy: User | null;

  @OneToMany(() => RoutineSchedule, (schedule) => schedule.routine)
  schedules: RoutineSchedule[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
