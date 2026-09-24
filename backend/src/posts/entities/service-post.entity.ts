import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Unit } from '../../units/entities/unit.entity';

/**
 * Posto de serviço (FR-022a): onde um policial é escalado num turno. Nem todo
 * posto é uma galeria (pórtico, garita, Infopen) e um posto pode cobrir mais
 * de uma galeria ("A/B"), por isso é uma entidade própria e não um texto
 * livre nem uma referência a `Gallery`. Só `WARDEN` cria, altera e desativa.
 */
@Entity('posts')
@Index(['unit', 'name'], { unique: true })
export class ServicePost {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Unit, { nullable: false })
  @JoinColumn({ name: 'unit_id' })
  unit: Unit;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'boolean', default: true })
  active: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
