import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { AdCampaignEntity } from './ad-campaign.entity';

@Entity('ad_creatives')
export class AdCreativeEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => AdCampaignEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'campaign_id' })
  campaign: AdCampaignEntity;

  @Column({ name: 'campaign_id' })
  campaignId: string;

  @Column('text')
  headline: string;

  @Column('text')
  body: string;

  @Column({ nullable: true })
  mediaUrl: string;

  @Column({ default: false })
  isPublished: boolean;

  @Column({ nullable: true })
  platformAdId: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
