import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { SupabaseStorageService } from '../src/modules/media/supabase-storage.service';
import { MediaAssets } from '../src/modules/content_items/entities/media_assets.entity';

/**
 * Migrate legacy /uploads media_assets rows to Supabase storage.
 * Run: npm run storage:migrate
 */
async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['log', 'error', 'warn'],
  });

  const storage = app.get(SupabaseStorageService);
  const dataSource = app.get(DataSource);
  const repo = dataSource.getRepository(MediaAssets);

  storage.assertConfigured();

  const rows = await repo.find({ order: { created_at: 'ASC' } });
  let migrated = 0;
  let skipped = 0;
  let failed = 0;

  for (const row of rows) {
    if (storage.isSupabaseUrl(row.mediaUrl)) {
      skipped++;
      continue;
    }

    try {
      const publicUrl = await storage.ensureSupabaseUrl(row.mediaUrl, row.tenantId);
      if (publicUrl !== row.mediaUrl) {
        await repo.update(row.id, { mediaUrl: publicUrl });
        migrated++;
        console.log(`Migrated ${row.id} → ${publicUrl}`);
      } else {
        skipped++;
      }
    } catch (err) {
      failed++;
      const message = err instanceof Error ? err.message : String(err);
      console.error(`Failed ${row.id} (${row.mediaUrl}): ${message}`);
    }
  }

  console.log(`Done. migrated=${migrated} skipped=${skipped} failed=${failed} total=${rows.length}`);
  await app.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
