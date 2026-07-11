import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Tenants } from '../../tenants/entities/tenants.entity';
import { UserEntity } from '../../user/user.entity';
import { Workspaces } from '../../workspaces/entities/workspaces.entity';

@Entity({ name: 'brand_profiles' })
export class BrandProfiles {
  @PrimaryGeneratedColumn('uuid')
  id: string;
  @Column({ type: 'uuid' })
  tenantId: string;
  @Column({ type: 'uuid' })
  userId: string;
  @Column({ type: 'uuid', nullable: true })
  workspaceId?: string;
  @Column({ type: 'text', default: 'business' })
  brandType: string;
  @Column({ type: 'text', nullable: true })
  companyName?: string;
  @Column({ type: 'text', nullable: true })
  industry?: string;
  @Column({ type: 'text', nullable: true })
  description?: string;
  @Column({ type: 'text', nullable: true })
  services?: string;
  @Column({ type: 'text', nullable: true })
  targetAudience?: string;
  @Column({ type: 'text', nullable: true })
  audiencePainPoints?: string;
  @Column({ type: 'text', nullable: true })
  toneOfVoice?: string;
  @Column({ type: 'text', nullable: true })
  brandPersonality?: string;
  @Column({ type: 'text', nullable: true })
  currentOffers?: string;
  @Column({ type: 'text', nullable: true })
  uniqueSellingPoints?: string;
  @Column({ type: 'text', nullable: true })
  faqs?: string;
  @Column({ type: 'text', nullable: true })
  caseStudies?: string;
  @Column({ type: 'text', nullable: true })
  bannedWords?: string;
  @Column({ type: 'text', nullable: true })
  bannedTopics?: string;
  @Column({ type: 'text', nullable: true })
  competitors?: string;
  @Column({ type: 'text', nullable: true })
  keywords?: string;
  @Column({ type: 'text', nullable: true })
  websiteUrl?: string;
  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
  @DeleteDateColumn({ type: 'timestamptz' })
  deleted_at?: Date;
  @ManyToOne(() => Tenants, { nullable: false })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenants;
  @ManyToOne(() => UserEntity, { nullable: false })
  @JoinColumn({ name: 'user_id' })
  user: UserEntity;
  @ManyToOne(() => Workspaces, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspace_id' })
  workspace?: Workspaces;
}
