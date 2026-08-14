import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Unit } from '../../units/entities/unit.entity';
import { Cell } from '../../cells/entities/cell.entity';

export enum GalleryType {
  MALE = 'MALE',
  FEMALE = 'FEMALE',
}

@Entity('galleries')
@Index(['unit', 'code'], { unique: true })
export class Gallery {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Unit, (unit) => unit.galleries, { nullable: false })
  @JoinColumn({ name: 'unit_id' })
  unit: Unit;

  @Column({ type: 'varchar', length: 50 })
  code: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'varchar', length: 50 })
  type: GalleryType;

  @Column({ type: 'boolean', default: true })
  active: boolean;

  @OneToMany(() => Cell, (cell) => cell.gallery)
  cells: Cell[];
}
