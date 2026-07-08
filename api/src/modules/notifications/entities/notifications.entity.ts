import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity({ name: 'notifications' })
export class Notifications {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  tenantId: string;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'varchar', length: 64 })
  type: string;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text' })
  body: string;

  @Column({ type: 'varchar', length: 512, nullable: true })
  link?: string;

  @Column({ type: 'boolean', default: false })
  read: boolean;

  @Column({ type: 'boolean', default: false })
  emailSent: boolean;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, unknown>;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
}
