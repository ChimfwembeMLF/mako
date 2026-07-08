import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Roles } from '../../auth/rbac/roles/entities/roles.entity';
import { UserEntity } from '../../user/user.entity';
import { Tenants } from '../../tenants/entities/tenants.entity';

@Index(['tenantId', 'actionKey'], { unique: true })
@Entity({ name: 'approval_workflows' })
export class ApprovalWorkflows {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  tenantId: string;

  @Column({ type: 'text' })
  actionKey: string;

  @Column({ type: 'text' })
  label: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'boolean' })
  isEnabled: boolean;

  @Column({ type: 'uuid' })
  approverRoleId: string;

  @Column({ type: 'uuid' })
  updatedBy: string;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;

  @ManyToOne(() => Tenants, { nullable: false })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenants;

  @ManyToOne(() => Roles, { nullable: false })
  @JoinColumn({ name: 'approver_role_id' })
  approverRole: Roles;

  @ManyToOne(() => UserEntity, { nullable: false })
  @JoinColumn({ name: 'updated_by' })
  updatedByUser: UserEntity;
}
