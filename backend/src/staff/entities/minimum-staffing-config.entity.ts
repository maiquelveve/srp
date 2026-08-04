import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Unit } from '../../units/entities/unit.entity';
import { User } from '../../users/entities/user.entity';
import { Shift } from './staff-schedule.entity';

/** Configurable minimum headcount per unit/sector/shift (FR-024, research.md #12). */
@Entity('minimum_staffing_config')
@Index(['unit', 'sector', 'shift'], { unique: true })
export class MinimumStaffingConfig {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Unit, { nullable: false })
  @JoinColumn({ name: 'unit_id' })
  unit: Unit;

  @Column({ type: 'varchar', length: 100 })
  sector: string;

  @Column({ type: 'varchar', length: 20 })
  shift: Shift;

  @Column({ type: 'int' })
  minimumHeadcount: number;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'updated_by' })
  updatedBy: User | null;

  @UpdateDateColumn()
  updatedAt: Date;
}
