import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Tenants } from '../../tenants/entities/tenants.entity';

export type InboxAttachment = {
  url?: string;
  type?: string;
  name?: string;
  mimeType?: string;
  mediaId?: string;
};

export type InboxReaction = {
  type: string;
  count?: number;
  userReacted?: boolean;
};

@Index(['tenantId', 'platform', 'threadId'])
@Entity({ name: 'social_messages' })
export class SocialMessages {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  tenantId: string;

  @Column({ type: 'uuid', nullable: true })
  workspaceId?: string;

  @Column({ type: 'text' })
  platform: string;

  @Column({ type: 'text' })
  threadId: string;

  @Column({ type: 'text', nullable: true })
  externalMessageId?: string;

  @Column({ type: 'text' })
  participantId: string;

  @Column({ type: 'text', nullable: true })
  participantName?: string;

  @Column({ type: 'text', nullable: true })
  participantAvatarUrl?: string;

  @Column({ type: 'text', default: 'inbound' })
  direction: 'inbound' | 'outbound';

  @Column({ type: 'text', default: '' })
  body: string;

  @Column({ type: 'jsonb', default: [] })
  attachments: InboxAttachment[];

  @Column({ type: 'jsonb', default: [] })
  reactions: InboxReaction[];

  @Column({ type: 'text', default: 'received' })
  status: string;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @ManyToOne(() => Tenants, { nullable: false })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenants;
}
