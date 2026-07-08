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

@Index(['tenantId', 'status', 'created_at'], { unique: true })
@Entity({ name: 'leads' })
export class Leads {
  @PrimaryGeneratedColumn('uuid')
  id: string;
  @Column({ type: 'uuid' })
  tenantId: string;
  @Column({ type: 'uuid', nullable: true })
  workspaceId?: string;
  @Column({ type: 'uuid' })
  userId: string;
  @Column({ type: 'text' })
  name: string;
  @Column({ type: 'text' })
  email: string;
  @Column({ type: 'text' })
  source: string;
  @Column({ type: 'text', nullable: true })
  message?: string;
  @Column({ type: 'text', nullable: true })
  classification?: string;
  @Column({ type: 'text', nullable: true })
  status?: string;
  @Column({ type: 'text', nullable: true })
  aiReply?: string;
  @Column({ type: 'boolean', nullable: true })
  unsubscribed?: boolean;
  @Column({ type: 'text', nullable: true })
  unsubscribeToken?: string;
  @DeleteDateColumn({ type: 'timestamptz' })
  deleted_at?: Date;
  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
  @ManyToOne(() => Tenants, { nullable: false })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenants;
  @ManyToOne(() => UserEntity, { nullable: false })
  @JoinColumn({ name: 'user_id' })
  user: UserEntity;
}
