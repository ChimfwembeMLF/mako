import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { UpsertIntegrationConfigDto } from './tenant-integration-config.dto';

const errors = (body: Record<string, unknown>) =>
  validateSync(plainToInstance(UpsertIntegrationConfigDto, body));

describe('UpsertIntegrationConfigDto', () => {
  it.each(['openai', 'gemini', 'mistral', 'deepseek'])('accepts a key for %s', (provider) => {
    expect(errors({ provider, apiKey: 'k' })).toHaveLength(0);
  });

  it.each(['self_hosted_parler', 'google_drive', 'nope'])('rejects a key for %s', (provider) => {
    expect(errors({ provider, apiKey: 'k' })).not.toHaveLength(0);
  });

  it('rejects an empty or oversized key', () => {
    expect(errors({ provider: 'openai', apiKey: '' })).not.toHaveLength(0);
    expect(errors({ provider: 'openai', apiKey: 'x'.repeat(2001) })).not.toHaveLength(0);
  });
});
