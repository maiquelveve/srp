import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

export enum AuditAction {
  INSERT = 'INSERT',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
  LOGIN = 'LOGIN',
  LOGIN_FAILED = 'LOGIN_FAILED',
  LOGOUT = 'LOGOUT',
}

/**
 * Immutable audit trail (Constitution III, FR-026/FR-027) — no controller or
 * repository ever exposes update/delete for this entity. `oldData`/`newData`
 * MUST have sensitive fields redacted before being persisted (research.md #6,
 * /speckit-analyze finding C1).
 */
@Entity('audit_logs')
export class AuditLog {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'user_id' })
  user: User | null;

  @Index()
  @Column({ type: 'varchar', length: 50, nullable: true })
  affectedTable: string | null;

  @Column({ type: 'int', nullable: true })
  recordId: number | null;

  @Column({ type: 'varchar', length: 20 })
  action: AuditAction;

  @Column({ type: 'jsonb', nullable: true })
  oldData: Record<string, unknown> | null;

  @Column({ type: 'jsonb', nullable: true })
  newData: Record<string, unknown> | null;

  @Index()
  @CreateDateColumn({ type: 'timestamptz' })
  timestamp: Date;
}
