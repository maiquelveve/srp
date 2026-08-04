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
import { Cell } from '../../cells/entities/cell.entity';
import { InmateCellHistory } from './inmate-cell-history.entity';

export enum InmateStatus {
  ACTIVE = 'ACTIVE',
  RELEASED = 'RELEASED',
  ANKLE_MONITOR = 'ANKLE_MONITOR',
  TRANSFERRED = 'TRANSFERRED',
  DECEASED = 'DECEASED',
}

@Entity('inmates')
export class Inmate {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 200 })
  name: string;

  /** RGI */
  @Column({ type: 'varchar', length: 50, unique: true, nullable: true })
  registrationId: string | null;

  @Column({ type: 'date', nullable: true })
  birthDate: string | null;

  /** e.g. 'CLOSED' | 'SEMI_OPEN' | 'OPEN' */
  @Column({ type: 'varchar', length: 50, nullable: true })
  custodyRegime: string | null;

  /** URL only — upload/storage provider not yet decided (research.md #13). */
  @Column({ type: 'text', nullable: true })
  photoUrl: string | null;

  /**
   * Projection kept transactionally in sync with movements/inmate_cell_history
   * (Constitution VI / research.md #9) — never written by an independent flow.
   */
  @Column({ type: 'varchar', length: 50, default: InmateStatus.ACTIVE })
  status: InmateStatus;

  @ManyToOne(() => Cell, (cell) => cell.inmates, { nullable: false })
  @JoinColumn({ name: 'current_cell_id' })
  currentCell: Cell;

  @OneToMany(() => InmateCellHistory, (history) => history.inmate)
  cellHistory: InmateCellHistory[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
