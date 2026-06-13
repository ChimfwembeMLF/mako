import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'data_protection_consents' })
export class DataProtectionConsents {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Anonymous browser id from localStorage. */
  @Index()
  @Column({ type: 'text' })
  visitorId: string;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  userId?: string;

  @Column({ type: 'text', default: '1' })
  consentVersion: string;

  @Column({ type: 'boolean', default: true })
  accepted: boolean;

  @Column({ type: 'text', nullable: true })
  ipAddress?: string;

  @Column({ type: 'text', nullable: true })
  userAgent?: string;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
}
