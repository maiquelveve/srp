import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Routine } from './routine.entity';
import { User } from '../../users/entities/user.entity';

/**
 * Per-date activation override for a Routine (FR-019, `PATCH
 * /routines/:id/activation`) — not documented in
 * `docs/srp_spec_database_model.md`'s original `routines`/`routine_schedules`
 * pair, added here because "ativar/desativar para uma data específica"
 * (contracts/routines.md) needs a value that wins over `Routine.active` for
 * exactly one calendar date, without touching the routine's own default or
 * its weekday-recurring `RoutineSchedule` rows.
 */
@Entity('routine_date_overrides')
@Index(['routine', 'date'], { unique: true })
export class RoutineDateOverride {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Routine, { nullable: false })
  @JoinColumn({ name: 'routine_id' })
  routine: Routine;

  @Column({ type: 'date' })
  date: string;

  @Column({ type: 'boolean' })
  active: boolean;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'updated_by' })
  updatedBy: User | null;
}
