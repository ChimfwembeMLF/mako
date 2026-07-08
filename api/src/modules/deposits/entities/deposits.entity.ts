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

@Entity({ name: 'deposits' })
export class Deposits {
  @PrimaryGeneratedColumn('uuid')
  id: string;
  @Column({ type: 'text', unique: true })
  depositId: string;
  @Column({ type: 'uuid' })
  tenantId: string;
  @Column({ type: 'text', nullable: true })
  plan?: string;
  @Column({ type: 'text', nullable: true })
  status?: string;
  @Column({ nullable: true })
  amount?: string;
  @Column({ type: 'text', nullable: true })
  currency?: string;
  @Column({ type: 'text', nullable: true })
  correspondent?: string;
  @Column({ type: 'text', nullable: true })
  msisdn?: string;
  @Column({ type: 'text', nullable: true })
  phone?: string;
  @Column({ type: 'text', nullable: true })
  provider?: string;
  @Column({ type: 'boolean', default: false })
  isRenewal: boolean;
  @Column({ type: 'jsonb', nullable: true })
  rawPayload?: string;
  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
  @ManyToOne(() => Tenants, { nullable: false })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenants;
}
