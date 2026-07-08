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

@Entity({ name: 'auto_reply_rules' })
export class AutoReplyRules {
  @PrimaryGeneratedColumn('uuid')
  id: string;
  @Column({ type: 'uuid' })
  tenantId: string;
  @Column({ type: 'uuid', nullable: true })
  workspaceId?: string;
  @Column({ type: 'text' })
  platform: string;
  @Column({ type: 'text' })
  name: string;
  @Column({ type: 'text', array: true, nullable: true })
  triggerKeywords?: string[];
  @Column({ type: 'text', nullable: true })
  triggerSentiment?: string;
  @Column({ type: 'text', nullable: true })
  responseTemplate?: string;
  @Column({ type: 'boolean' })
  aiGenerate: boolean;
  @Column({ type: 'boolean' })
  isActive: boolean;
  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
  @DeleteDateColumn({ type: 'timestamptz' })
  deleted_at?: Date;
  @ManyToOne(() => Tenants, { nullable: false })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenants;
}
