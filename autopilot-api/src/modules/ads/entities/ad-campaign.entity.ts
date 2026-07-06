import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export enum AdPlatform {
  META = 'META',
  GOOGLE = 'GOOGLE',
  EMBED = 'EMBED',
  TIKTOK = 'TIKTOK',
  LINKEDIN = 'LINKEDIN',
  PINTEREST = 'PINTEREST',
  TABOOLA = 'TABOOLA',
  X = 'X',
}

export enum AdCampaignStatus {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  PAUSED = 'PAUSED',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

@Entity('ad_campaigns')
export class AdCampaignEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  tenantId: string;

  @Column({ type: 'enum', enum: AdPlatform, default: AdPlatform.META })
  platform: AdPlatform;

  @Column({ nullable: true })
  platformCampaignId: string; // The ID from Meta or Google, or hash for EMBED

  @Column()
  name: string;

  @Column({ type: 'enum', enum: AdCampaignStatus, default: AdCampaignStatus.DRAFT })
  status: AdCampaignStatus;

  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  dailyBudget: number;

  @Column({ nullable: true })
  targetAudience: string;

  @Column({ nullable: true })
  targetUrl: string;

  @Column({ nullable: true })
  location: string;

  @Column({ type: 'date', nullable: true })
  startDate: Date;

  @Column({ type: 'date', nullable: true })
  endDate: Date;

  @Column({ nullable: true })
  ageRange: string;

  @Column({ default: 0 })
  nativeImpressions: number;

  @Column({ default: 0 })
  nativeClicks: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
