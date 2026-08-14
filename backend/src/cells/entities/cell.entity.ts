import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Gallery } from '../../galleries/entities/gallery.entity';
import { Inmate } from '../../inmates/entities/inmate.entity';

export enum CellType {
  SHARED = 'SHARED',
  INDIVIDUAL = 'INDIVIDUAL',
}

@Entity('cells')
@Index(['gallery', 'code'], { unique: true })
export class Cell {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Gallery, (gallery) => gallery.cells, { nullable: false })
  @JoinColumn({ name: 'gallery_id' })
  gallery: Gallery;

  @Column({ type: 'varchar', length: 20 })
  code: string;

  @Column({ type: 'int', default: 0 })
  capacity: number;

  @Column({ type: 'varchar', length: 50 })
  type: CellType;

  @Column({ type: 'boolean', default: true })
  active: boolean;

  @OneToMany(() => Inmate, (inmate) => inmate.currentCell)
  inmates: Inmate[];
}
