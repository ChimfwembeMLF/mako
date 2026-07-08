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

@Index(['tenantId', 'userId'], { unique: true })
@Entity({ name: 'lead_sources' })
export class LeadSources {
  @PrimaryGeneratedColumn('uuid')
  id: string;
  @Column({ type: 'uuid' })
  tenantId: string;
  @Column({ type: 'uuid' })
  userId: string;
  @Column({ type: 'text' })
  label: string;
  @Column({ type: 'text', nullable: true })
  webhookSecret?: string;
  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
  @ManyToOne(() => Tenants, { nullable: false })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenants;
  @ManyToOne(() => UserEntity, { nullable: false })
  @JoinColumn({ name: 'user_id' })
  user: UserEntity;
}
