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

  @Column({ type: 'text', nullable: true })
  destinationLocation: string | null;

  @Column({ type: 'text', nullable: true })
  reason: string | null;

  @Column({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  exitDateTime: Date;

  /** Required only for category=TEMPORARY, null until returned (FR-009). */
  @Column({ type: 'timestamptz', nullable: true })
  returnDateTime: Date | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  /** Client-generated UUID for offline idempotency (FR-011a). */
  @Index({ unique: true, where: 'idempotency_key IS NOT NULL' })
  @Column({ type: 'uuid', nullable: true })
  idempotencyKey: string | null;

  @ManyToOne(() => User, { nullable: false })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @CreateDateColumn()
  createdAt: Date;
}
