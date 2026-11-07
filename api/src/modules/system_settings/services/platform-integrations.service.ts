import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { SystemSettingsService } from '../system_settings.service';
import { EncryptionService } from '../../tenants/services/encryption.service';

const INTEGRATIONS_KEY = 'platform_integrations';

export type EncryptedValue = {
  encryptedData: string;
  iv: string;
  authTag: string;
};

/**
 * The last values loaded from Backoffice → Integrations, for code that reads settings
 * synchronously (e.g. the WhatsApp platform number). Kept fresh by the service below.
 */
let loadedIntegrations: Record<string, string> = {};
let refreshIntegrations: (() => void) | null = null;

/** A Backoffice → Integrations value if one is saved, otherwise undefined (callers fall back to env). */
export function integrationSetting(key: string): string | undefined {
  refreshIntegrations?.();
  return loadedIntegrations[key]?.trim() || undefined;
}

@Injectable()
export class PlatformIntegrationsService implements OnModuleInit {
  private readonly logger = new Logger(PlatformIntegrationsService.name);
  private cache: Record<string, string> | null = null;
  private lastFetchTime = 0;
  private readonly CACHE_TTL_MS = 60 * 1000; // 1 minute cache

  constructor(
    private readonly settings: SystemSettingsService,
    private readonly encryption: EncryptionService,
  ) {}

  async onModuleInit() {
    refreshIntegrations = () => {
      if (Date.now() - this.lastFetchTime >= this.CACHE_TTL_MS) {
        void this.getAllIntegrations().catch(() => undefined);
      }
    };
    await this.getAllIntegrations().catch(() => undefined);
  }

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
      loadedIntegrations = result;
      return result;
    } catch (e) {
      // If not found, return empty object and cache it
      this.cache = {};
      this.lastFetchTime = now;
      loadedIntegrations = {};
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

    // Invalidate cache, and reload so synchronous readers see the new values straight away.
    this.cache = null;
    this.lastFetchTime = 0;
    await this.getAllIntegrations().catch(() => undefined);
  }
}
