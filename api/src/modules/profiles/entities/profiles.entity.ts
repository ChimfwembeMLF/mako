import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { UserEntity } from '../../user/user.entity';

@Entity({ name: 'profiles' })
export class Profiles {
  @PrimaryGeneratedColumn('uuid')
  id: string;
  @Column({ type: 'uuid', unique: true })
  userId: string;
  @Column({ type: 'text', nullable: true })
  displayName?: string;
  @Column({ type: 'text', nullable: true })
  fullName?: string;
  @Column({ type: 'text', nullable: true })
  avatarUrl?: string;
  @Column({ type: 'boolean', nullable: true })
  isSystemAdmin?: boolean;
  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
  @ManyToOne(() => UserEntity, { nullable: false })
  @JoinColumn({ name: 'user_id' })
  user: UserEntity;
}
