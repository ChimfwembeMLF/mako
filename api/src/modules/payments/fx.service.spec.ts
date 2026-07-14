import { FxService } from './fx.service';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

jest.mock('axios');

describe('FxService', () => {
  const mockedGet = axios.get as jest.MockedFunction<typeof axios.get>;
  const config = {
    get: jest.fn(() => undefined),
  } as unknown as ConfigService;
  let fx: FxService;

  beforeEach(() => {
    jest.clearAllMocks();
    fx = new FxService(config);
  });

  it('returns 1:1 quote for ZMW', async () => {
    const quote = await fx.quoteFromZmw(375, 'ZMW');
    expect(quote.currency).toBe('ZMW');
    expect(quote.amount).toBe('375.00');
    expect(quote.rate).toBe(1);
  });

  it('converts ZMW to KES using live rates', async () => {
    mockedGet.mockResolvedValue({
      data: {
        result: 'success',
        rates: { KES: 7.16, ZMW: 1 },
        time_last_update_utc: 'Mon, 14 Jul 2026 00:00:00 +0000',
      },
    } as never);

    const quote = await fx.quoteFromZmw(375, 'KES');
    expect(quote.currency).toBe('KES');
    expect(Number(quote.amount)).toBeGreaterThan(2600);
    expect(quote.source).toBe('live');
  });

  it('converts local amount back to ZMW for ads credit', async () => {
    mockedGet.mockResolvedValue({
      data: {
        result: 'success',
        rates: { KES: 7.16, ZMW: 1 },
      },
    } as never);

    const quote = await fx.quoteToZmw(3580, 'KES');
    expect(quote.currency).toBe('KES');
    expect(Number(quote.amountZmw)).toBeGreaterThan(400);
  });

  it('uses fallback rates when API fails', async () => {
    mockedGet.mockRejectedValue(new Error('network down'));

    const quote = await fx.quoteFromZmw(100, 'KES');
    expect(quote.source).toBe('fallback');
    expect(Number(quote.amount)).toBeGreaterThan(100);
  });
});
