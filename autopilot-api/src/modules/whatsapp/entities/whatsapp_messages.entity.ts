import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Tenants } from '../../tenants/entities/tenants.entity';
import { WhatsappContacts } from '../../whatsapp_contacts/entities/whatsapp_contacts.entity';

@Index(['tenantId', 'created_at'])
@Index(['waMessageId'], { unique: true })
@Entity({ name: 'whatsapp_messages' })
export class WhatsappMessages {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  tenantId: string;

  @Column({ type: 'uuid', nullable: true })
  contactId?: string;

  @Column({ type: 'uuid', nullable: true })
  leadId?: string;

  @Column({ type: 'text', nullable: true })
  waMessageId?: string;

  @Column({ type: 'text' })
  phone: string;

  @Column({ type: 'text' })
  direction: 'inbound' | 'outbound';

  @Column({ type: 'text' })
  body: string;

  @Column({ type: 'text', default: 'delivered' })
  status: string;

  @Column({ type: 'text', nullable: true })
  errorMessage?: string;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @ManyToOne(() => Tenants, { nullable: false })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenants;

  @ManyToOne(() => WhatsappContacts, { nullable: true })
  @JoinColumn({ name: 'contact_id' })
  contact?: WhatsappContacts;
}
