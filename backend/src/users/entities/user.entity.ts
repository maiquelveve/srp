import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  JoinTable,
  ManyToMany,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Role } from '../../roles/entities/role.entity';
import { Unit } from '../../units/entities/unit.entity';
import { RefreshToken } from './refresh-token.entity';
import { Sensitive } from '../../common/decorators/sensitive.decorator';

/**
 * A prison officer (FR-021) is a User with role=PRISON_OFFICER — there is no
 * separate Staff entity (research.md #15, /speckit-analyze finding I1).
 */
@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 150 })
  name: string;

  @Column({ type: 'varchar', length: 150, unique: true })
  email: string;

  /** Argon2 hash — never returned by any API, always redacted in audit_logs (research.md #6). */
  @Sensitive()
  @Column({ type: 'varchar', length: 255 })
  passwordHash: string;

  @Column({ type: 'varchar', length: 50, unique: true, nullable: true })
  badgeNumber: string | null;

  /** Cargo — relevant mainly for role=PRISON_OFFICER (FR-021, research.md #15). */
  @Column({ type: 'varchar', length: 100, nullable: true })
  jobTitle: string | null;

  @ManyToOne(() => Role, (role) => role.users, { nullable: false })
  @JoinColumn({ name: 'role_id' })
  role: Role;

  @ManyToMany(() => Unit, (unit) => unit.users)
  @JoinTable({
    name: 'user_units',
    joinColumn: { name: 'user_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'unit_id', referencedColumnName: 'id' },
  })
  units: Unit[];

  @Column({ type: 'boolean', default: true })
  active: boolean;

  @OneToMany(() => RefreshToken, (token) => token.user)
  refreshTokens: RefreshToken[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
