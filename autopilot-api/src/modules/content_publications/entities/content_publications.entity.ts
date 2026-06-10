import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Tenants } from '../../tenants/entities/tenants.entity';
import { ContentItems } from '../../content_items/entities/content_items.entity';
import { SocialAccounts } from '../../social_accounts/entities/social_accounts.entity';

@Index(['contentId', 'platform'])
@Index(['tenantId', 'status'])
@Entity({ name: 'content_publications' })
export class ContentPublications {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  tenantId: string;

  @Column({ type: 'uuid' })
  contentId: string;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'text' })
  platform: string;

  @Column({ type: 'text', nullable: true })
  externalPostId?: string;

  @Column({ type: 'text' })
  publishedContent: string;

  @Column({ type: 'text', nullable: true })
  publishedTitle?: string;

  @Column({ type: 'jsonb', nullable: true })
  publishedMedia?: Array<{ url: string; type?: string; name?: string }>;

  @Column({ type: 'uuid', nullable: true })
  socialAccountId?: string;

  /** published | failed */
  @Column({ type: 'text', default: 'published' })
  status: string;

  @Column({ type: 'text', nullable: true })
  errorMessage?: string;

  @Column({ type: 'timestamptz', nullable: true })
  publishedAt?: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;

  @ManyToOne(() => Tenants, { nullable: false })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenants;

  @ManyToOne(() => ContentItems, { nullable: false })
  @JoinColumn({ name: 'content_id' })
  content: ContentItems;

  @ManyToOne(() => SocialAccounts, { nullable: true })
  @JoinColumn({ name: 'social_account_id' })
  socialAccount?: SocialAccounts;
}
