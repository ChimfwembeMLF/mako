const complete = jest.fn();
jest.mock('@mistralai/mistralai', () => ({
  Mistral: jest.fn().mockImplementation(() => ({ chat: { complete } })),
}));

import { ServiceUnavailableException } from '@nestjs/common';
import { MistralChatService } from './mistral-chat.service';

function apiError(status: number, message: string) {
  return Object.assign(new Error(`API error occurred: Status ${status}\nBody: ${message}`), { statusCode: status });
}

const reply = (text: string) => ({ choices: [{ message: { content: text } }], usage: { totalTokens: 5 } });

function setup(env: Record<string, string> = {}) {
  const config = { get: jest.fn((k: string) => env[k]) };
  const configRepo = { findOne: jest.fn(async () => null) };
  const integrations = { getIntegrationWithEnvFallback: jest.fn(async () => 'platform-key') };
  return new MistralChatService(config as any, configRepo as any, {} as any, integrations as any);
}

describe('MistralChatService fallback', () => {
  beforeEach(() => complete.mockReset());

  it('retries on the fallback model when the requested model is over its limit', async () => {
    complete.mockRejectedValueOnce(apiError(429, 'Rate limit exceeded')).mockResolvedValueOnce(reply('ok'));
    const result = await setup().complete([{ role: 'user', content: 'hi' }]);

    expect(result).toMatchObject({ content: 'ok', model: 'ministral-8b-latest' });
    expect(complete.mock.calls.map((c) => c[0].model)).toEqual(['mistral-small-latest', 'ministral-8b-latest']);
  });

  it('also falls back when the model is not on the plan', async () => {
    complete.mockRejectedValueOnce(apiError(403, 'Forbidden')).mockResolvedValueOnce(reply('ok'));
    const result = await setup().complete([{ role: 'user', content: 'hi' }], { model: 'mistral-large-latest' });
    expect(result.model).toBe('ministral-8b-latest');
  });

  it('uses MISTRAL_FALLBACK_MODEL when set', async () => {
    complete.mockRejectedValueOnce(apiError(429, 'Rate limit exceeded')).mockResolvedValueOnce(reply('ok'));
    const result = await setup({ MISTRAL_FALLBACK_MODEL: 'open-mistral-nemo' }).complete([{ role: 'user', content: 'hi' }]);
    expect(result.model).toBe('open-mistral-nemo');
  });

  it('explains a usage limit in plain words when the fallback is limited too', async () => {
    complete.mockRejectedValue(apiError(429, 'Rate limit exceeded'));
    await expect(setup().complete([{ role: 'user', content: 'hi' }])).rejects.toThrow(
      new ServiceUnavailableException(
        'The Mistral account has reached its usage limit. Raise the limit or upgrade the plan at admin.mistral.ai.',
      ),
    );
    expect(complete).toHaveBeenCalledTimes(2);
  });

  it('does not retry other errors', async () => {
    complete.mockRejectedValueOnce(apiError(400, 'Bad request'));
    await expect(setup().complete([{ role: 'user', content: 'hi' }])).rejects.toThrow();
    expect(complete).toHaveBeenCalledTimes(1);
  });
});
