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
    enum: ['local', 'facebook', 'google', 'linkedin', 'instagram', 'twitter'],
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

  /** Set only after the owner proves the number with an SMS code. */
  @Column({ type: 'timestamptz', nullable: true })
  phoneVerifiedAt?: Date | null;

  @Column({ type: 'text', nullable: true })
  pendingPhone?: string | null;

  @Column({ type: 'text', nullable: true })
  phoneCodeHash?: string | null;

  @Column({ type: 'text', nullable: true })
  phoneCodePurpose?: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  phoneCodeExpiresAt?: Date | null;

  @Column({ type: 'int', default: 0 })
  phoneCodeAttempts: number;

  @Column({ type: 'timestamptz', nullable: true })
  phoneCodeSentAt?: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  phoneCodeWindowStart?: Date | null;

  @Column({ type: 'int', default: 0 })
  phoneCodeSendCount: number;

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

  @Column({ nullable: true })
  isRegisteredWithTwitter?: boolean;

  /** AES-256-GCM encrypted Google OAuth access token (Gmail API). */
  @Column({ type: 'text', nullable: true, select: false })
  googleAccessTokenEnc?: string;

  /** AES-256-GCM encrypted Google OAuth refresh token. */
  @Column({ type: 'text', nullable: true, select: false })
  googleRefreshTokenEnc?: string;

  @Column({ type: 'timestamptz', nullable: true })
  googleTokenExpiresAt?: Date;

  @Column({ type: 'jsonb', default: {} })
  preferences?: Record<string, any>;
}
