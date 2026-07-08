import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

export type ChatChannel = 'admin' | 'widget' | 'api';

@Entity({ name: 'chat_sessions' })
export class ChatSession {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  tenantId: string;

  @Column({ type: 'uuid', nullable: true })
  workspaceId?: string;

  @Column({ type: 'uuid' })
  configId: string;

  @Column({ type: 'varchar', length: 32 })
  channel: ChatChannel;

  @Column({ type: 'varchar', length: 64, nullable: true })
  visitorId?: string;

  @Column({ type: 'uuid', nullable: true })
  userId?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  title?: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, unknown>;

  @Column({ type: 'timestamptz', nullable: true })
  lastMessageAt?: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
}
