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
import { SocialAccounts } from '../../social_accounts/entities/social_accounts.entity';

@Entity({ name: 'social_insights' })
export class SocialInsights {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  tenantId: string;

  @Column({ type: 'uuid', nullable: true })
  workspaceId?: string;

  @Column({ type: 'uuid' })
  socialAccountId: string;

  @Column({ type: 'date' })
  date: Date; // The date these metrics represent

  @Column({ type: 'int', default: 0 })
  followersCount: number;

  @Column({ type: 'int', default: 0 })
  reach: number;

  @Column({ type: 'int', default: 0 })
  impressions: number;

  @Column({ type: 'int', default: 0 })
  engagement: number;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;

  @ManyToOne(() => Tenants, { nullable: false })
  @JoinColumn({ name: 'tenantId' })
  tenant: Tenants;

  @ManyToOne(() => SocialAccounts, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'socialAccountId' })
  socialAccount: SocialAccounts;
}
