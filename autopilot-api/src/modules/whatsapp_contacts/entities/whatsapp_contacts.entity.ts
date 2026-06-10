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

@Index(['tenantId', 'phone'], { unique: true })
@Entity({ name: 'whatsapp_contacts' })
export class WhatsappContacts {
  @PrimaryGeneratedColumn('uuid')
  id: string;
  @Column({ type: 'uuid' })
  tenantId: string;
  @Column({ type: 'text' })
  phone: string;
  @Column({ type: 'text', nullable: true })
  name?: string;
  @Column({ type: 'boolean' })
  optedIn: boolean;
  @Column({ type: 'timestamptz', nullable: true })
  optedInAt?: Date;
  @Column({ type: 'text', array: true, nullable: true })
  tags?: string[];

  @Column({ type: 'uuid', nullable: true })
  leadId?: string;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
  @ManyToOne(() => Tenants, { nullable: false })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenants;
}
