import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Tenants } from '../../tenants/entities/tenants.entity';
import { Workspaces } from '../../workspaces/entities/workspaces.entity';
import { UserEntity } from '../../user/user.entity';

@Entity({ name: 'content_campaigns' })
export class ContentCampaigns {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  tenantId: string;

  @Column({ type: 'uuid' })
  workspaceId: string;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'text' })
  name: string;

  @Column({ type: 'text', nullable: true })
  goal?: string;

  @Column({ type: 'text', nullable: true })
  theme?: string;

  @Column({ type: 'text', array: true, nullable: true })
  platforms?: string[];

  @Column({ type: 'int', default: 0 })
  postCount: number;

  @Column({ type: 'date', nullable: true })
  startDate?: Date;

  @Column({ type: 'text', default: 'active' })
  status: string;

  @Column({ type: 'text', nullable: true })
  summary?: string;

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
}
