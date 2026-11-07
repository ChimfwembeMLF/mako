jest.mock('../leads/leads.service', () => ({ LeadsService: class {} }));
jest.mock('../leads/services/lead-classify.service', () => ({ LeadClassifyService: class {} }));

import { worthClassifying } from './whatsapp-lead.service';

describe('worthClassifying', () => {
  const fresh = { classification: 'inbound' };
  const labelled = { classification: 'hot' };

  it('skips small talk and media placeholders', () => {
    for (const text of ['ok', 'Thanks!', 'hi', '👍', '📷 image', '']) {
      expect(worthClassifying(text, fresh)).toBe(false);
    }
  });

  it("classifies a new lead's first real message", () => {
    expect(worthClassifying('Do you deliver to Kitwe?', fresh)).toBe(true);
  });

  it('leaves an already labelled lead alone for short or recent messages', () => {
    expect(worthClassifying('What time do you open?', labelled)).toBe(false);
    const long = 'I would like to order twenty bags of coffee for our office every month please';
    expect(worthClassifying(long, labelled, Date.now() - 60_000)).toBe(false);
    expect(worthClassifying(long, labelled, Date.now() - 7 * 3600_000)).toBe(true);
  });
});
