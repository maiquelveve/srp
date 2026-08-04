import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { User } from '../../users/entities/user.entity';

export enum RoleName {
  PRISON_OFFICER = 'PRISON_OFFICER',
  SUPERVISOR = 'SUPERVISOR',
  WARDEN = 'WARDEN',
}

@Entity('roles')
export class Role {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 50, unique: true })
  name: RoleName;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @OneToMany(() => User, (user) => user.role)
  users: User[];
}
