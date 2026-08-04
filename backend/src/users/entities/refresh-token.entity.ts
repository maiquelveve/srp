import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from './user.entity';
import { Sensitive } from '../../common/decorators/sensitive.decorator';

/**
 * Persisted refresh tokens allow real revocation on logout for stateless JWTs
 * (research.md #11, /speckit-analyze finding G3).
 */
@Entity('refresh_tokens')
export class RefreshToken {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User, (user) => user.refreshTokens, { nullable: false })
  @JoinColumn({ name: 'user_id' })
  user: User;

  /** SHA-256 hash of the refresh token — never the token in clear text. */
  @Sensitive()
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 255 })
  tokenHash: string;

  @Column({ type: 'timestamptz' })
  expiresAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  revokedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;
}
