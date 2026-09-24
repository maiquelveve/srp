import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { ServicePost } from '../../posts/entities/service-post.entity';
import { Shift } from './staff-schedule.entity';

/** Configurable minimum headcount per post/shift (FR-024, research.md #12). */
@Entity('minimum_staffing_config')
@Index(['post', 'shift'], { unique: true })
export class MinimumStaffingConfig {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => ServicePost, { nullable: false })
  @JoinColumn({ name: 'post_id' })
  post: ServicePost;

  @Column({ type: 'varchar', length: 20 })
  shift: Shift;

  @Column({ type: 'int' })
  minimumHeadcount: number;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'updated_by' })
  updatedBy: User | null;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
