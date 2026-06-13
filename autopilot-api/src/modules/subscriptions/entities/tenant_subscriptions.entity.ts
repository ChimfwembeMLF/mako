import {
  Entity,
  PrimaryColumn,
  Column,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Tenants } from '../../tenants/entities/tenants.entity';

@Entity({ name: 'tenant_subscriptions' })
export class TenantSubscriptions {
  @PrimaryColumn({ type: 'uuid' })
  tenantId: string;

  @Column({ type: 'text', default: 'free' })
  plan: string;

  @Column({ type: 'text', default: 'active' })
  status: string;

  @Column({ type: 'boolean', default: false })
  dailyWorkflowEnabled: boolean;

  @Column({ type: 'timestamptz' })
  billingPeriodStart: Date;

  @Column({ type: 'timestamptz' })
  billingPeriodEnd: Date;

  @Column({ type: 'boolean', default: false })
  autoRenewEnabled: boolean;

  @Column({ type: 'text', nullable: true })
  renewalPhone?: string;

  @Column({ type: 'text', nullable: true })
  renewalCorrespondent?: string;

  @Column({ type: 'int', default: 0 })
  renewalAttempts: number;

  @Column({ type: 'timestamptz', nullable: true })
  lastRenewalAttemptAt?: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;

  @ManyToOne(() => Tenants, { nullable: false })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenants;
}
