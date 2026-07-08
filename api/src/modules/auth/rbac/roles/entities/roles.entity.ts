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

@Index(['tenantId', 'name'], { unique: true })
@Entity({ name: 'roles' })
export class Roles {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  tenantId: string;

  @Column({ type: 'text' })
  name: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'boolean', nullable: true })
  isSystem?: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @ManyToOne(() => Tenants, { nullable: false })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenants;
}
