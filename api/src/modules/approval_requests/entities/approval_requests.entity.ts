import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Tenants } from '../../tenants/entities/tenants.entity';
import { UserEntity } from '../../user/user.entity';

@Index(['status', 'created_at'], { unique: true })
@Index(['tenantId', 'status'], { unique: true })
@Entity({ name: 'approval_requests' })
export class ApprovalRequests {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  tenantId: string;

  @Column({ type: 'text' })
  actionKey: string;

  @Column({ type: 'text' })
  resourceType: string;

  @Column({ type: 'uuid' })
  resourceId: string;

  @Column({ type: 'jsonb', nullable: true })
  payload?: string;

  @Column({ type: 'uuid' })
  requestedBy: string;

  @Column({ type: 'uuid', nullable: true })
  reviewedBy?: string;

  @Column({ type: 'text' })
  status: string;

  @Column({ type: 'text', nullable: true })
  requesterNotes?: string;

  @Column({ type: 'text', nullable: true })
  reviewerNotes?: string;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @Column({ type: 'timestamptz', nullable: true })
  reviewedAt?: Date;

  @ManyToOne(() => Tenants, { nullable: false })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenants;

  @ManyToOne(() => UserEntity, { nullable: false })
  @JoinColumn({ name: 'requested_by' })
  requester: UserEntity;

  @ManyToOne(() => UserEntity, { nullable: true })
  @JoinColumn({ name: 'reviewed_by' })
  reviewer?: UserEntity;
}
