import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export type TemplateStatus =
  | 'DRAFT'
  | 'PENDING'
  | 'APPROVED'
  | 'REJECTED'
  | 'PAUSED';

export type TemplateCategory = 'MARKETING' | 'UTILITY' | 'AUTHENTICATION';

export interface TemplateComponentParam {
  type: 'text' | 'image' | 'video' | 'document';
  text?: string;
}

export interface TemplateButton {
  type: 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER';
  text: string;
  url?: string;
  phone_number?: string;
}

export interface TemplateComponent {
  type: 'HEADER' | 'BODY' | 'FOOTER' | 'BUTTONS';
  format?: 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT';
  text?: string;
  buttons?: TemplateButton[];
  example?: { header_text?: string[]; body_text?: string[][] };
}

export interface TemplateVariable {
  /** e.g. "customer_name" — friendly label for UI */
  key: string;
  /** positional index in Meta payload: 1-based */
  position: number;
  /** which component this variable belongs to */
  component: 'HEADER' | 'BODY';
  example?: string;
}

@Entity({ name: 'whatsapp_templates' })
export class WhatsappTemplate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  tenantId: string;

  @Column({ type: 'uuid', nullable: true })
  workspaceId?: string;

  /** Snake_case name as required by Meta (e.g. order_confirmation) */
  @Column({ type: 'text' })
  name: string;

  @Column({ type: 'text', default: 'en' })
  language: string;

  @Column({ type: 'text', default: 'UTILITY' })
  category: TemplateCategory;

  @Column({ type: 'text', default: 'DRAFT' })
  status: TemplateStatus;

  /** Full Meta component array — stored as-is for re-submission */
  @Column({ type: 'jsonb', default: '[]' })
  components: TemplateComponent[];

  /** Named variable slots extracted from {{N}} placeholders */
  @Column({ type: 'jsonb', default: '[]' })
  variables: TemplateVariable[];

  /** ID returned by Meta after successful submission */
  @Column({ type: 'text', nullable: true })
  metaTemplateId?: string;

  /** Meta rejection reason if status = REJECTED */
  @Column({ type: 'text', nullable: true })
  rejectionReason?: string;

  /** When we last polled Meta for status */
  @Column({ type: 'timestamptz', nullable: true })
  syncedAt?: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
