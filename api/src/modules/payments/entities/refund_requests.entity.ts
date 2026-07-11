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
import { Deposits } from '../../deposits/entities/deposits.entity';

export type RefundStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

@Entity({ name: 'refund_requests' })
export class RefundRequests {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  tenantId: string;

  @Column({ type: 'uuid' })
  depositId: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount: string;

  @Column({ type: 'text' })
  reason: string;

  @Column({ type: 'text', default: 'PENDING' })
  status: RefundStatus;

  @Column({ type: 'text', nullable: true })
  adminNotes?: string;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;

  @ManyToOne(() => Tenants, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenantId' })
  tenant: Tenants;

  @ManyToOne(() => Deposits, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'depositId' })
  deposit: Deposits;
}
