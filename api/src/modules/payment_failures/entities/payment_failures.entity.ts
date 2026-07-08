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

@Entity({ name: 'payment_failures' })
export class PaymentFailures {
  @PrimaryGeneratedColumn('uuid')
  id: string;
  @Column({ type: 'text' })
  depositId: string;
  @Column({ type: 'uuid' })
  tenantId: string;
  @Column({ type: 'text', nullable: true })
  provider?: string;
  @Column({ type: 'text', nullable: true })
  reason?: string;
  @Column({ type: 'jsonb', nullable: true })
  rawPayload?: string;
  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
  @ManyToOne(() => Tenants, { nullable: false })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenants;
}
