import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Inmate } from '../../inmates/entities/inmate.entity';
import { MovementType } from './movement-type.entity';
import { Cell } from '../../cells/entities/cell.entity';
import { User } from '../../users/entities/user.entity';

@Entity('movements')
export class Movement {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Inmate, { nullable: false })
  @JoinColumn({ name: 'inmate_id' })
  inmate: Inmate;

  @ManyToOne(() => MovementType, { nullable: false })
  @JoinColumn({ name: 'movement_type_id' })
  movementType: MovementType;

  @ManyToOne(() => Cell, { nullable: false })
  @JoinColumn({ name: 'origin_cell_id' })
  originCell: Cell;

  /** Only set for cell-change permanent movements. */
  @ManyToOne(() => Cell, { nullable: true })
  @JoinColumn({ name: 'destination_cell_id' })
  destinationCell: Cell | null;

  @Column({ type: 'text' })
  destinationLocation: string;

  @Column({ type: 'text', nullable: true })
  reason: string | null;

  @Column({ name: 'exit_datetime', type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  exitDateTime: Date;

  /** Required only for category=TEMPORARY, null until returned (FR-009). */
  @Column({ name: 'return_datetime', type: 'timestamptz', nullable: true })
  returnDateTime: Date | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  /** Client-generated UUID for offline idempotency of the exit (FR-011a). */
  @Index({ unique: true, where: 'idempotency_key IS NOT NULL' })
  @Column({ type: 'uuid', nullable: true })
  idempotencyKey: string | null;

  /**
   * Separate key for the return action (PATCH .../return) — the exit's
   * idempotencyKey is already spent identifying this row, so a retried
   * return needs its own key to be told apart from a genuine second
   * (rejected, FR-009) return attempt on the same movement.
   */
  @Index({ unique: true, where: 'return_idempotency_key IS NOT NULL' })
  @Column({ type: 'uuid', nullable: true })
  returnIdempotencyKey: string | null;

  /**
   * Links the two rows a permuta (cell-swap/gallery-swap) creates — one per
   * inmate, preserving "Movement = one inmate per row" (research.md #26) —
   * to the row created for the other inmate in the same swap. Null for every
   * other movement type. Per-ROW, not per-inmate: an inmate gets a fresh
   * Movement row (with its own correct partner) every time it swaps, so past
   * pairings are never overwritten by a later one (research.md #35, worked
   * example under "Como o pareamento se comporta ao longo do tempo").
   */
  @Index({ unique: true, where: 'paired_movement_id IS NOT NULL' })
  @Column({ name: 'paired_movement_id', type: 'int', nullable: true })
  pairedMovementId: number | null;

  @ManyToOne(() => User, { nullable: false })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
