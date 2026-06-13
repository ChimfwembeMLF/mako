import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Index(['confirmationCode'], { unique: true })
@Entity({ name: 'data_deletion_requests' })
export class DataDeletionRequests {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text' })
  confirmationCode: string;

  @Column({ type: 'text', default: 'meta' })
  platform: string;

  @Column({ type: 'text', nullable: true })
  externalUserId?: string;

  @Column({ type: 'text', nullable: true })
  email?: string;

  @Column({ type: 'uuid', nullable: true })
  userId?: string;

  @Column({ type: 'text', nullable: true })
  ipAddress?: string;

  @Column({ type: 'text', nullable: true })
  userAgent?: string;

  /** pending | completed | failed */
  @Column({ type: 'text', default: 'pending' })
  status: string;

  @Column({ type: 'timestamptz', nullable: true })
  completedAt?: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
}
