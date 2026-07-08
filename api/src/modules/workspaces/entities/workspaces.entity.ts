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

@Index(['tenantId', 'slug'], { unique: true })
@Entity({ name: 'workspaces' })
export class Workspaces {
  @PrimaryGeneratedColumn('uuid')
  id: string;
  @Column({ type: 'uuid' })
  tenantId: string;
  @Column({ type: 'text' })
  name: string;
  @Column({ type: 'text' })
  slug: string;
  @Column({ type: 'text', nullable: true })
  logoUrl?: string;
  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
  @ManyToOne(() => Tenants, { nullable: false })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenants;
}
