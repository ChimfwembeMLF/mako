import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Tenants } from '../../tenants/entities/tenants.entity';
import type { BotGraph } from './whatsapp-bot.types';

/**
 * A visual WhatsApp bot. Several can be live on one number: each live bot answers
 * the keywords in `triggers`, and the default bot answers everything else.
 */
@Entity({ name: 'whatsapp_bots' })
@Index(['tenantId', 'workspaceId'])
export class WhatsappBot {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'workspace_id', type: 'uuid', nullable: true })
  workspaceId?: string | null;

  @Column({ type: 'text' })
  name: string;

  @Column({ type: 'text', nullable: true })
  description?: string | null;

  /** draft | live */
  @Column({ type: 'text', default: 'draft' })
  status: 'draft' | 'live';

  /** Answers messages that match no live bot's keywords. At most one per workspace. */
  @Column({ name: 'is_default', type: 'boolean', default: false })
  isDefault: boolean;

  /** Lower-case keywords that start this bot (e.g. ["order", "track"]). */
  @Column({ type: 'jsonb', default: '[]' })
  triggers: string[];

  @Column({ type: 'jsonb', default: () => `'{"nodes":[],"edges":[]}'` })
  graph: BotGraph;

  @Column({ name: 'published_at', type: 'timestamptz', nullable: true })
  publishedAt?: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updated_at: Date;

  @ManyToOne(() => Tenants, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenants;
}
