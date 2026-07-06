import { Controller, Get, Param, Res, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Response } from 'express';
import { ConfigService } from '@nestjs/config';
import {
  AdCampaignEntity,
  AdCampaignStatus,
} from './entities/ad-campaign.entity';
import { AdCreativeEntity } from './entities/ad-creative.entity';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { resolveApiPublicUrl } from '../../common/env-urls.util';

@ApiTags('Public Embed Ads')
@Controller('embed-ads')
export class EmbedAdsController {
  private readonly logger = new Logger(EmbedAdsController.name);

  constructor(
    @InjectRepository(AdCampaignEntity)
    private readonly campaignRepo: Repository<AdCampaignEntity>,
    @InjectRepository(AdCreativeEntity)
    private readonly creativeRepo: Repository<AdCreativeEntity>,
    private readonly config: ConfigService,
  ) {}

  @Get('widget/:id.js')
  @ApiOperation({ summary: 'Serve the dynamic JS widget for a self-hosted ad' })
  async serveWidget(
    @Param('id') platformCampaignId: string,
    @Res() res: Response,
  ) {
    const campaign = await this.campaignRepo.findOne({
      where: { platformCampaignId },
    });
    if (!campaign || campaign.status !== AdCampaignStatus.ACTIVE) {
      return res.status(404).send('console.error("Ad not found or inactive");');
    }

    const creative = await this.creativeRepo.findOne({
      where: { campaignId: campaign.id },
    });
    if (!creative) {
      return res.status(404).send('console.error("Ad creative not found");');
    }

    // Increment impressions natively
    await this.campaignRepo.increment(
      { id: campaign.id },
      'nativeImpressions',
      1,
    );

    // Build the dynamic JavaScript that renders the banner
    const apiBase = resolveApiPublicUrl(this.config) || 'http://localhost:4000';
    const redirectUrl = `${apiBase}/embed-ads/click/${platformCampaignId}`;

    // A clean, modern banner ad injected into the DOM
    const jsContent = `
      (function() {
        var container = document.createElement('div');
        container.style.cssText = 'font-family: system-ui, -apple-system, sans-serif; max-width: 728px; margin: 20px auto; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); cursor: pointer; transition: transform 0.2s; background: linear-gradient(to right, #f8fafc, #f1f5f9);';
        
        container.onmouseover = function() { this.style.transform = 'translateY(-2px)'; };
        container.onmouseout = function() { this.style.transform = 'translateY(0)'; };
        container.onclick = function() { window.open('${redirectUrl}', '_blank'); };

        var content = document.createElement('div');
        content.style.cssText = 'padding: 24px; display: flex; align-items: center; justify-content: space-between;';

        var textCol = document.createElement('div');
        var headline = document.createElement('h3');
        headline.innerText = ${JSON.stringify(creative.headline)};
        headline.style.cssText = 'margin: 0 0 8px 0; font-size: 20px; font-weight: 700; color: #1e293b;';
        
        var body = document.createElement('p');
        body.innerText = ${JSON.stringify(creative.body)};
        body.style.cssText = 'margin: 0; font-size: 15px; color: #475569; line-height: 1.5;';

        var btn = document.createElement('button');
        btn.innerText = 'Learn More';
        btn.style.cssText = 'background: #2563eb; color: white; border: none; padding: 10px 20px; border-radius: 6px; font-weight: 600; cursor: pointer; white-space: nowrap; margin-left: 20px;';

        textCol.appendChild(headline);
        textCol.appendChild(body);
        content.appendChild(textCol);
        content.appendChild(btn);
        container.appendChild(content);

        // Find the script tag that loaded this and insert the banner after it
        var scripts = document.getElementsByTagName('script');
        var currentScript = scripts[scripts.length - 1];
        currentScript.parentNode.insertBefore(container, currentScript.nextSibling);
      })();
    `;

    res.setHeader('Content-Type', 'application/javascript');
    return res.status(200).send(jsContent);
  }

  @Get('click/:id')
  @ApiOperation({ summary: 'Track a click and redirect to the target URL' })
  async trackClick(
    @Param('id') platformCampaignId: string,
    @Res() res: Response,
  ) {
    const campaign = await this.campaignRepo.findOne({
      where: { platformCampaignId },
    });
    if (!campaign || campaign.status !== AdCampaignStatus.ACTIVE) {
      return res.status(404).send('Ad not found or inactive');
    }

    // Increment clicks natively
    await this.campaignRepo.increment({ id: campaign.id }, 'nativeClicks', 1);

    // Redirect to their target URL (or fallback)
    const target = campaign.targetUrl || 'https://google.com';
    return res.redirect(302, target);
  }
}
