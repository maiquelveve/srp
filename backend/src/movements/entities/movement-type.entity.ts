import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

export enum MovementCategory {
  TEMPORARY = 'TEMPORARY',
  PERMANENT = 'PERMANENT',
}

@Entity('movement_types')
export class MovementType {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 100, unique: true })
  name: string;

  @Column({ type: 'varchar', length: 50 })
  category: MovementCategory;

  @Column({ type: 'text', nullable: true })
  description: string | null;
}
