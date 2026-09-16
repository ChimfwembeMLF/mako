import { Injectable, Logger } from '@nestjs/common';
import { SystemSettingsService } from '../system_settings.service';
import { EncryptionService } from '../../tenants/services/encryption.service';

const INTEGRATIONS_KEY = 'platform_integrations';

export type EncryptedValue = {
  encryptedData: string;
  iv: string;
  authTag: string;
};

@Injectable()
export class PlatformIntegrationsService {
  private readonly logger = new Logger(PlatformIntegrationsService.name);
  private cache: Record<string, string> | null = null;
  private lastFetchTime = 0;
  private readonly CACHE_TTL_MS = 60 * 1000; // 1 minute cache

  constructor(
    private readonly settings: SystemSettingsService,
    private readonly encryption: EncryptionService,
  ) {}

  async getAllIntegrations(): Promise<Record<string, string>> {
    const now = Date.now();
    if (this.cache && now - this.lastFetchTime < this.CACHE_TTL_MS) {
      return this.cache;
    }

    try {
      const ent = await this.settings.findOne(INTEGRATIONS_KEY);
      const values = ent.value as Record<string, EncryptedValue>;
      const result: Record<string, string> = {};
      
      for (const [key, encryptedObj] of Object.entries(values)) {
        if (encryptedObj && encryptedObj.encryptedData && encryptedObj.iv && encryptedObj.authTag) {
          try {
            result[key] = this.encryption.decrypt(
              encryptedObj.encryptedData,
              encryptedObj.iv,
              encryptedObj.authTag
            );
          } catch (e) {
            this.logger.error(`Failed to decrypt integration key: ${key}`, e);
          }
        }
      }

      this.cache = result;
      this.lastFetchTime = now;
      return result;
    } catch (e) {
      // If not found, return empty object and cache it
      this.cache = {};
      this.lastFetchTime = now;
      return {};
    }
  }

  async getIntegration(key: string): Promise<string | undefined> {
    const integrations = await this.getAllIntegrations();
    return integrations[key];
  }

  async getIntegrationWithEnvFallback(key: string): Promise<string | undefined> {
    const dbValue = await this.getIntegration(key);
    return dbValue || process.env[key];
  }

  async saveIntegrations(updates: Record<string, string>): Promise<void> {
    let currentValues: Record<string, EncryptedValue> = {};
    try {
      const ent = await this.settings.findOne(INTEGRATIONS_KEY);
      currentValues = ent.value as Record<string, EncryptedValue>;
    } catch (e) {
      // Not found, starting fresh
    }

    for (const [key, value] of Object.entries(updates)) {
      // If value is empty string, we can either delete or keep it empty. 
      // Deleting is cleaner if we want to fallback to env.
      if (value) {
        currentValues[key] = this.encryption.encrypt(value);
      } else {
        delete currentValues[key];
      }
    }

    await this.settings.upsert(INTEGRATIONS_KEY, {
      value: currentValues,
      description: 'Global platform integration keys (encrypted)',
    });

    // Invalidate cache
    this.cache = null;
  }
}
