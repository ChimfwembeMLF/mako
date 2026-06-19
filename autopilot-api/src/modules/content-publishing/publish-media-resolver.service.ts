import { Injectable } from '@nestjs/common';
import { SupabaseStorageService } from '../media/supabase-storage.service';
import { MediaAttachment } from './interfaces/publish-result.interface';

@Injectable()
export class PublishMediaResolverService {
  constructor(private readonly storage: SupabaseStorageService) {}

  /** Ensure all publish attachments use Supabase public HTTPS URLs. */
  async resolveForPublish(
    media: MediaAttachment[],
    tenantId: string,
  ): Promise<MediaAttachment[]> {
    this.storage.assertConfigured();

    const resolved: MediaAttachment[] = [];
    for (const item of media) {
      resolved.push({
        ...item,
        media_url: await this.storage.ensureSupabaseUrl(
          item.media_url,
          tenantId,
          'publish',
        ),
      });
    }
    return resolved;
  }

  readLocalUpload(url: string) {
    return this.storage.readLocalUpload(url);
  }
}
