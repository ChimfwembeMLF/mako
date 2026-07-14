import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Tenants } from '../../tenants/entities/tenants.entity';

@Index(['tenantId', 'created_at'])
@Index(['gmailMessageId'], { unique: true })
@Entity({ name: 'mail_messages' })
export class MailMessages {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  tenantId: string;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'uuid', nullable: true })
  workspaceId?: string;

  @Column({ type: 'text' })
  gmailMessageId: string;

  @Column({ type: 'text', nullable: true })
  threadId?: string;

  @Column({ type: 'text' })
  fromEmail: string;

  @Column({ type: 'text', nullable: true })
  subject?: string;

  @Column({ type: 'text' })
  body: string;

  @Column({ type: 'text' })
  direction: 'inbound' | 'outbound';

  @Column({ type: 'text', default: 'inbound' })
  status: string;

  @Column({ type: 'uuid', nullable: true })
  ruleId?: string;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @ManyToOne(() => Tenants, { nullable: false })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenants;
}
