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
 * Single-use, short-expiry token letting a user created via `POST /users`
 * set their own initial password out of band, without the creator ever
 * choosing/transmitting a password in clear text (research.md #10,
 * /speckit-analyze finding G1/U1).
 */
@Entity('invite_tokens')
export class InviteToken {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User, { nullable: false })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Sensitive()
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 255 })
  tokenHash: string;

  @Column({ type: 'timestamptz' })
  expiresAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  usedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;
}
