import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

@Entity({ name: 'notification_preferences' })
export class NotificationPreferences {
  @PrimaryColumn({ type: 'uuid' })
  userId: string;

  @PrimaryColumn({ type: 'uuid' })
  tenantId: string;

  @Column({ type: 'boolean', default: true })
  emailPublishSuccess: boolean;

  @Column({ type: 'boolean', default: true })
  emailBilling: boolean;

  @Column({ type: 'boolean', default: true })
  emailWeeklyDigest: boolean;

  @Column({ type: 'boolean', default: true })
  emailHotLeads: boolean;

  @Column({ type: 'boolean', default: true })
  inAppEnabled: boolean;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
