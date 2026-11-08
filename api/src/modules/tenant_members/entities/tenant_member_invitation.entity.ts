import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity({ name: 'tenant_member_invitations' })
@Index(['tenantId', 'email'])
export class TenantMemberInvitation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  tenantId: string;

  @Column({ type: 'text' })
  email: string;

  @Column({ type: 'uuid' })
  roleId: string;

  @Column({ type: 'uuid' })
  invitedBy: string;

  @Column({ type: 'text', default: 'pending' })
  status: 'pending' | 'accepted' | 'revoked' | 'declined';

  @Column({ type: 'timestamptz' })
  expiresAt: Date;

  /** Workspaces the invitee will be able to use; null means all of them. */
  @Column({ type: 'uuid', array: true, nullable: true })
  workspaceIds?: string[] | null;

  @Column({ type: 'timestamptz', nullable: true })
  acceptedAt?: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
}
