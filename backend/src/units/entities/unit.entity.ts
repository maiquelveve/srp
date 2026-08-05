import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToMany,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Gallery } from '../../galleries/entities/gallery.entity';

@Entity('units')
export class Unit {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 150 })
  name: string;

  @Column({ type: 'varchar', length: 20, unique: true, nullable: true })
  code: string | null;

  @Column({ type: 'text', nullable: true })
  address: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  phone: string | null;

  @Column({ type: 'boolean', default: true })
  active: boolean;

  @ManyToMany(() => User, (user) => user.units)
  users: User[];

  @OneToMany(() => Gallery, (gallery) => gallery.unit)
  galleries: Gallery[];

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
