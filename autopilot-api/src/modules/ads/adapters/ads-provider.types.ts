import { AdCampaignEntity } from '../entities/ad-campaign.entity';
import { AdCreativeEntity } from '../entities/ad-creative.entity';

export interface AdsPublishPayload {
  campaign: AdCampaignEntity;
  creative: AdCreativeEntity;
  userId: string;
}
