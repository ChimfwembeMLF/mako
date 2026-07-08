import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Tenants } from '../../tenants/entities/tenants.entity';

@Entity({ name: 'whatsapp_flow_sessions' })
@Index(['tenantId', 'phone'], { unique: true })
export class WhatsappFlowSession {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  tenantId: string;

  @Column({ type: 'text' })
  phone: string;

  @Column({ type: 'text', default: 'MAIN_MENU' })
  currentState: string;

  @Column({ type: 'jsonb', default: {} })
  context: Record<string, unknown>;

  @Column({ type: 'timestamptz', nullable: true })
  expiresAt?: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;

  @ManyToOne(() => Tenants, { nullable: false })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenants;
}
