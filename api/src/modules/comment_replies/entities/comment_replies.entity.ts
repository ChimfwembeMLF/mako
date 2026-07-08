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
import { Tenants } from '../../tenants/entities/tenants.entity';
import { ContentItems } from '../../content_items/entities/content_items.entity';
import { AutoReplyRules } from '../../auto_reply_rules/entities/auto_reply_rules.entity';

@Index(['tenantId', 'externalCommentId'], { unique: true })
@Entity({ name: 'comment_replies' })
export class CommentReplies {
  @PrimaryGeneratedColumn('uuid')
  id: string;
  @Column({ type: 'uuid' })
  tenantId: string;
  @Column({ type: 'uuid' })
  contentId: string;
  @Column({ type: 'text' })
  platform: string;
  @Column({ type: 'text' })
  externalCommentId: string;
  @Column({ type: 'text' })
  externalPostId: string;
  @Column({ type: 'text' })
  commenterName: string;
  @Column({ type: 'text', nullable: true })
  commenterAvatarUrl?: string;
  @Column({ type: 'text' })
  commentText: string;
  @Column({ type: 'text', nullable: true })
  replyText?: string;
  @Column({ type: 'text', nullable: true })
  replyType?: string;
  @Column({ type: 'text', nullable: true })
  status?: string;
  @Column({ type: 'uuid', nullable: true })
  ruleId?: string;
  @Column({ type: 'timestamptz', nullable: true })
  sentAt?: Date;
  @Column({ type: 'text', nullable: true })
  parentCommentId?: string;
  @Column({ type: 'int', default: 0 })
  likeCount: number;
  @Column({ type: 'boolean', default: false })
  isFromBrand: boolean;

  @Column({ type: 'jsonb', default: [] })
  attachments: Array<{ url?: string; type?: string; name?: string }>;

  @Column({ type: 'jsonb', default: [] })
  reactions: Array<{ type: string; count?: number }>;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
  @ManyToOne(() => Tenants, { nullable: false })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenants;
  @ManyToOne(() => ContentItems, { nullable: false })
  @JoinColumn({ name: 'content_id' })
  content: ContentItems;
  @ManyToOne(() => AutoReplyRules, { nullable: true })
  @JoinColumn({ name: 'rule_id' })
  rule: AutoReplyRules;
}
