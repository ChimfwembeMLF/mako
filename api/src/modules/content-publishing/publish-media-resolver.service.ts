import { Injectable } from '@nestjs/common';
import { S3StorageService } from '../media/s3-storage.service';
import { MediaAttachment } from './interfaces/publish-result.interface';

@Injectable()
export class PublishMediaResolverService {
  constructor(private readonly storage: S3StorageService) {}

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
        media_url: await this.storage.ensureS3Url(
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
