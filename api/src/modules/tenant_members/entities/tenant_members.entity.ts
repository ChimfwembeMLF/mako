import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Tenants } from '../../tenants/entities/tenants.entity';
import { UserEntity } from '../../user/user.entity';

@Index(['tenantId', 'userId'], { unique: true })
@Entity({ name: 'tenant_members' })
export class TenantMembers {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  tenantId: string;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'uuid' })
  roleId: string;

  @Column({ type: 'boolean' })
  isActive: boolean;

  @Column({ type: 'uuid' })
  invitedBy: string;

  @Column({ type: 'timestamptz' })
  joinedAt: Date;

  @ManyToOne(() => Tenants, { nullable: false })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenants;

  @ManyToOne(() => UserEntity, { nullable: false })
  @JoinColumn({ name: 'user_id' })
  user: UserEntity;

  @ManyToOne(() => UserEntity, { nullable: false })
  @JoinColumn({ name: 'invited_by' })
  inviter: UserEntity;
}
