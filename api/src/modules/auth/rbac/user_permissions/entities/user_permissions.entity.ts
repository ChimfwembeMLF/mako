import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Tenants } from '../../../../tenants/entities/tenants.entity';
import { Permissions } from '../../permissions/entities/permissions.entity';
import { UserEntity } from '../../../../user/user.entity';

@Index(['tenantId', 'userId', 'permissionKey'], { unique: true })
@Index(['validUntil'], { unique: true })
@Entity({ name: 'user_permissions' })
export class UserPermissions {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  tenantId: string;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'text' })
  permissionKey: string;

  @Column({ type: 'text' })
  effect: string;

  @Column({ type: 'timestamptz', nullable: true })
  validFrom?: Date;

  @Column({ type: 'timestamptz', nullable: true })
  validUntil?: Date;

  @Column({ type: 'uuid' })
  grantedBy: string;

  @Column({ type: 'text', nullable: true })
  reason?: string;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @ManyToOne(() => Tenants, { nullable: false })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenants;

  @ManyToOne(() => UserEntity, { nullable: false })
  @JoinColumn({ name: 'user_id' })
  user: UserEntity;

  @ManyToOne(() => Permissions, { nullable: false })
  @JoinColumn({ name: 'permission_key' })
  permission: Permissions;

  @ManyToOne(() => UserEntity, { nullable: false })
  @JoinColumn({ name: 'granted_by' })
  granter: UserEntity;
}
