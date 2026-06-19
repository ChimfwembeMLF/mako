import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { RoleType } from '../../constants';

@Entity({ name: 'users' })
export class UserEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @Column({
    type: 'enum',
    enum: ['local', 'facebook', 'google', 'linkedin', 'instagram'],
    default: 'local',
  })
  provider: string;

  @Column({ nullable: true })
  providerId?: string;

  @Column({ nullable: true })
  firstName?: string;

  @Column({ nullable: true })
  lastName?: string;

  @Column({ type: 'enum', enum: RoleType, default: RoleType.USER })
  role: RoleType;

  @Column({ unique: true, nullable: true })
  email?: string;

  @Column({ nullable: true })
  password?: string;

  @Column({ nullable: true })
  phone?: string;

  @Column({ nullable: true })
  avatar?: string;

  @Column({ nullable: true })
  isRegisteredWithGoogle?: boolean;

  @Column({ nullable: true })
  isRegisteredWithFacebook?: boolean;

  @Column({ nullable: true })
  isRegisteredWithLinkedIn?: boolean;

  @Column({ nullable: true })
  isRegisteredWithInstagram?: boolean;
}
