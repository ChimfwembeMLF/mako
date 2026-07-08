import {
  Entity,
  PrimaryColumn,
  Column,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Roles } from '../../roles/entities/roles.entity';
import { Permissions } from '../../permissions/entities/permissions.entity';

@Index(['roleId', 'permissionKey'], { unique: true })
@Entity({ name: 'role_permissions' })
export class RolePermissions {
  @PrimaryColumn({ type: 'uuid' })
  roleId: string;

  @PrimaryColumn({ type: 'text' })
  permissionKey: string;

  @ManyToOne(() => Roles, { nullable: false })
  @JoinColumn({ name: 'role_id' })
  role: Roles;

  @ManyToOne(() => Permissions, { nullable: false })
  @JoinColumn({ name: 'permission_key' })
  permission: Permissions;
}
