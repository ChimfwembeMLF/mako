import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Tenants } from '../../tenants/entities/tenants.entity';
import { WhatsappMenuItem } from '../whatsapp-menu.types';

@Entity({ name: 'whatsapp_flow_configs' })
export class WhatsappFlowConfig {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  tenantId: string;

  @Column({ type: 'uuid', nullable: true })
  workspaceId?: string;

  @Column({ type: 'boolean', default: false })
  enabled: boolean;

  /** Brand / business name shown in the welcome line, e.g. "Acme Shop" */
  @Column({ type: 'text', default: 'MyService' })
  serviceName: string;

  /** Optional custom welcome line; {serviceName} is substituted if present */
  @Column({ type: 'text', nullable: true })
  welcomeMessage?: string;

  @Column({ type: 'text', default: 'configurable_menu' })
  flowType: string;

  @Column({ type: 'jsonb', default: [] })
  menuItems: WhatsappMenuItem[];

  /** When true, free-text messages (not matching the menu) get an AI reply */
  @Column({ type: 'boolean', default: true })
  aiFallbackEnabled: boolean;

  @Column({
    type: 'text',
    array: true,
    default: () => "ARRAY['hi','hello','menu','start','0']",
  })
  welcomeTriggers: string[];

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;

  @ManyToOne(() => Tenants, { nullable: false })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenants;
}
