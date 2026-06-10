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
import { Workspaces } from '../../workspaces/entities/workspaces.entity';
import { UserEntity } from '../../user/user.entity';
import { BrandProfiles } from '../../brand_profiles/entities/brand_profiles.entity';

@Index(['tenantId', 'status', 'scheduledDate'])
@Index(['workspaceId', 'status'])
@Entity({ name: 'content_items' })
export class ContentItems {
  @PrimaryGeneratedColumn('uuid')
  id: string;
  @Column({ type: 'uuid' })
  tenantId: string;
  @Column({ type: 'uuid' })
  workspaceId: string;
  @Column({ type: 'uuid' })
  userId: string;
  @Column({ type: 'uuid', nullable: true })
  brandProfileId?: string;
  @Column({ type: 'text' })
  contentType: string;
  @Column({ type: 'text' })
  title: string;
  @Column({ type: 'text' })
  content: string;
  @Column({ type: 'text', nullable: true })
  campaignTheme?: string;
  @Column({ type: 'uuid', nullable: true })
  campaignId?: string;
  @Column({ type: 'text', nullable: true })
  status?: string;
  @Column({ type: 'text', array: true, nullable: true })
  platforms?: string[];
  @Column({ type: 'jsonb', nullable: true })
  platformPayloads?: string;
  @Column({ type: 'date', nullable: true })
  scheduledDate?: Date;
  @Column({ type: 'timetz', nullable: true })
  scheduledTime?: Date;
  @Column({ type: 'timestamptz', nullable: true })
  publishedAt?: Date;
  @Column({ type: 'text', nullable: true })
  externalPostId?: string;
  @Column({ type: 'text', nullable: true })
  publishFailedReason?: string;
  @DeleteDateColumn({ type: 'timestamptz' })
  deleted_at?: Date;
  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
  @ManyToOne(() => Tenants, { nullable: false })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenants;
  @ManyToOne(() => Workspaces, { nullable: false })
  @JoinColumn({ name: 'workspace_id' })
  workspace: Workspaces;
  @ManyToOne(() => UserEntity, { nullable: false })
  @JoinColumn({ name: 'user_id' })
  user: UserEntity;
  @ManyToOne(() => BrandProfiles, { nullable: true })
  @JoinColumn({ name: 'brand_profile_id' })
  brandProfile?: BrandProfiles;
}
