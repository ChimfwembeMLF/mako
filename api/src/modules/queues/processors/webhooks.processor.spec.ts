jest.mock('../../whatsapp/whatsapp-inbound.service', () => ({ WhatsappInboundService: class {} }));
jest.mock('../../social_inbox/social-messaging-inbound.service', () => ({ SocialMessagingInboundService: class {} }));
jest.mock('../../leads/leads.service', () => ({ LeadsService: class {} }));
jest.mock('../../leads/services/lead-classify.service', () => ({ LeadClassifyService: class {} }));
jest.mock('../../lead_sources/lead_sources.service', () => ({ LeadSourcesService: class {} }));

import { WebhooksProcessor } from './webhooks.processor';
import { JOB_WHATSAPP_INBOUND } from '../queue.constants';

describe('WebhooksProcessor Meta events', () => {
  const whatsapp = { handleMetaWebhook: jest.fn(async () => ({ received: true })) };
  const social = { handleMetaWebhook: jest.fn(async () => ({ received: true })) };
  const processor = new WebhooksProcessor(whatsapp as any, { get: () => social } as any, {} as any, {} as any, {} as any);
  const run = (object: string) => processor.process({ name: JOB_WHATSAPP_INBOUND, data: { body: { object } } } as any);

  beforeEach(() => jest.clearAllMocks());

  it.each(['page', 'instagram'])('sends %s DMs to the social inbox, not WhatsApp', async (object) => {
    await run(object);
    expect(social.handleMetaWebhook).toHaveBeenCalled();
    expect(whatsapp.handleMetaWebhook).not.toHaveBeenCalled();
  });

  it('sends WhatsApp events to WhatsApp', async () => {
    await run('whatsapp_business_account');
    expect(whatsapp.handleMetaWebhook).toHaveBeenCalled();
    expect(social.handleMetaWebhook).not.toHaveBeenCalled();
  });
});
