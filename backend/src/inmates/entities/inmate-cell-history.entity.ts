import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Inmate } from './inmate.entity';
import { Cell } from '../../cells/entities/cell.entity';
import { User } from '../../users/entities/user.entity';

export enum CellHistoryReason {
  CELL_CHANGE = 'CELL_CHANGE',
  RELEASE = 'RELEASE',
  ANKLE_MONITOR = 'ANKLE_MONITOR',
  TRANSFER = 'TRANSFER',
}

/** Timeline used to reconstruct an inmate's location history (FR-016). */
@Entity('inmate_cell_history')
export class InmateCellHistory {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Inmate, (inmate) => inmate.cellHistory, { nullable: false })
  @JoinColumn({ name: 'inmate_id' })
  inmate: Inmate;

  @ManyToOne(() => Cell, { nullable: false })
  @JoinColumn({ name: 'cell_id' })
  cell: Cell;

  @Column({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  entryDate: Date;

  @Column({ type: 'timestamptz', nullable: true })
  exitDate: Date | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  reason: CellHistoryReason | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'user_id' })
  user: User | null;
}
