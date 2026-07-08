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
import { UserEntity } from '../../user/user.entity';

@Index(['tenantId', 'created_at'])
@Index(['userId', 'created_at'])
@Entity({ name: 'audit_logs' })
export class AuditLogs {
  @PrimaryGeneratedColumn('uuid')
  id: string;
  @Column({ type: 'uuid', nullable: true })
  tenantId?: string;
  @Column({ type: 'uuid', nullable: true })
  userId?: string;
  @Column({ type: 'text' })
  action: string;
  @Column({ type: 'text' })
  resourceType: string;
  @Column({ type: 'uuid', nullable: true })
  resourceId?: string;
  @Column({ type: 'jsonb', nullable: true })
  beforeState?: string;
  @Column({ type: 'jsonb', nullable: true })
  afterState?: string;
  @Column({ type: 'jsonb', nullable: true })
  metadata?: string;
  @Column({ type: 'text', nullable: true })
  ipAddress?: string;
  @Column({ type: 'text', nullable: true })
  userAgent?: string;
  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
  @ManyToOne(() => Tenants, { nullable: true })
  @JoinColumn({ name: 'tenant_id' })
  tenant?: Tenants;
  @ManyToOne(() => UserEntity, { nullable: true })
  @JoinColumn({ name: 'user_id' })
  user?: UserEntity;
}
