import 'reflect-metadata';
import { loadEnvFiles } from './load-env';

loadEnvFiles();

import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { DataSource, Repository } from 'typeorm';
import { AppModule } from '../src/app.module';
import { TenantBootstrapService } from '../src/modules/tenants/tenant-bootstrap.service';
import { Tenants } from '../src/modules/tenants/entities/tenants.entity';
import { UserEntity } from '../src/modules/user/user.entity';

/**
 * Production bootstrap — permissions, theme, billing plans, tenant defaults, Mako widget key.
 * Does NOT create demo users.
 *
 * Env (in .env on server):
 *   MAKO_WIDGET_API_KEY — must match VITE_WIDGET_API_KEY in resources/client
 *   SEED_MAKO_OWNER_EMAIL — production owner account (or exactly one tenant in DB)
 *
 * Run: npm run seed:prod
 */
async function resolveMakoTenant(
  tenantsRepo: Repository<Tenants>,
  usersRepo: Repository<UserEntity>,
): Promise<Tenants | null> {
  const ownerEmail = process.env.SEED_MAKO_OWNER_EMAIL?.trim();
  if (ownerEmail) {
    const user = await usersRepo.findOne({ where: { email: ownerEmail } });
    if (!user) {
      console.warn(`SEED_MAKO_OWNER_EMAIL not found: ${ownerEmail} — sign up first, then re-run seed:prod`);
      return null;
    }
    const tenant = await tenantsRepo.findOne({ where: { ownerId: user.id } });
    if (!tenant) {
      console.warn(`No tenant for ${ownerEmail} — sign up via the app, then re-run seed:prod`);
      return null;
    }
    return tenant;
  }

  const tenants = await tenantsRepo.find({ select: ['id', 'ownerId', 'name', 'slug'] });
  if (tenants.length === 0) {
    console.warn('No tenants in database — core seed done; sign up via the app, then re-run seed:prod for widget/tenant data');
    return null;
  }
  if (tenants.length === 1) {
    console.log(`Using sole tenant: ${tenants[0].name} (${tenants[0].slug})`);
    return tenants[0];
  }

  console.warn(
    `Found ${tenants.length} tenants — set SEED_MAKO_OWNER_EMAIL in .env and re-run seed:prod to sync the widget key`,
  );
  return null;
}

function resolveWidgetKey(config: ConfigService): string | undefined {
  return (
    config.get<string>('MAKO_WIDGET_API_KEY')?.trim() ||
    config.get<string>('DEMO_WIDGET_API_KEY')?.trim() ||
    process.env.MAKO_WIDGET_API_KEY?.trim() ||
    process.env.DEMO_WIDGET_API_KEY?.trim()
  );
}

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['log', 'error', 'warn'],
  });

  const config = app.get(ConfigService);
  const bootstrapService = app.get(TenantBootstrapService);
  const dataSource = app.get(DataSource);
  const tenantsRepo = dataSource.getRepository(Tenants);
  const usersRepo = dataSource.getRepository(UserEntity);

  const { TemplateSeedService } = await import('../src/modules/templates/template-seed.service');
  const { AutoReplySeedService } = await import('../src/modules/auto_reply_rules/auto-reply-seed.service');
  const { BrandProfileSeedService } = await import('../src/modules/brand_profiles/brand-profile-seed.service');
  const { ChatbotWidgetSeedService } = await import('../src/modules/chatbot/chatbot-widget-seed.service');
  const templateSeeds = app.get(TemplateSeedService);
  const autoReplySeeds = app.get(AutoReplySeedService);
  const brandProfileSeeds = app.get(BrandProfileSeedService);
  const widgetSeed = app.get(ChatbotWidgetSeedService);

  console.log('Seeding permissions...');
  await bootstrapService.ensurePermissionsSeeded();
  console.log('Permissions seeded.');

  const { SystemSettingsService, DEFAULT_THEME } = await import(
    '../src/modules/system_settings/system_settings.service'
  );
  const settingsService = app.get(SystemSettingsService);
  await settingsService.upsert('theme', {
    value: DEFAULT_THEME,
    description: 'Global UI theme (HSL values without hsl() wrapper)',
  });
  console.log('Default theme seeded.');

  const { PlansSeedService } = await import('../src/modules/subscriptions/plans-seed.service');
  const plansResult = await app.get(PlansSeedService).ensureSeeded();
  console.log(`Billing plans ${plansResult}.`);

  console.log('Ensuring all users in database are bootstrapped...');
  const allUsers = await usersRepo.find();
  let bootstrappedCount = 0;
  for (const user of allUsers) {
    try {
      await bootstrapService.bootstrapForUser(user);
      bootstrappedCount++;
    } catch (err) {
      console.error(`Failed to bootstrap user ${user.email ?? user.id}:`, err);
    }
  }
  console.log(`Bootstrapped/verified ${bootstrappedCount} user(s).`);

  console.log('Seeding tenant defaults for all tenants...');
  const allTenants = await tenantsRepo.find({ select: ['id', 'ownerId'] });
  const backfilled = await autoReplySeeds.backfillTenantsWithNoRules();
  if (backfilled > 0) {
    console.log(`Backfilled ${backfilled} auto-reply rule(s) for tenants with none.`);
  }
  for (const tenant of allTenants) {
    if (!tenant.ownerId) continue;
    await templateSeeds.ensureSeededForTenant(tenant.id, tenant.ownerId);
    await autoReplySeeds.ensureSeededForTenant(tenant.id);
    const owner = await usersRepo.findOne({ where: { id: tenant.ownerId } });
    if (owner) {
      await brandProfileSeeds.ensureStarterForUser(tenant.id, owner);
    }
  }
  console.log(`Tenant defaults seeded for ${allTenants.length} tenant(s).`);

  const makoTenant = await resolveMakoTenant(tenantsRepo, usersRepo);
  if (!makoTenant) {
    console.log('\nProduction seed complete (global data only — no tenant/widget sync).');
    await app.close();
    return;
  }

  const widgetKey = resolveWidgetKey(config);

  console.log(`Syncing Mako widget for tenant ${makoTenant.name} (${makoTenant.id})...`);
  if (widgetKey) {
    if (!widgetKey.startsWith('pk_live_')) {
      throw new Error('MAKO_WIDGET_API_KEY must start with pk_live_');
    }
    const widgetResult = await widgetSeed.ensureSeededForTenant(makoTenant.id, {
      secret: widgetKey,
      label: 'Mako embed',
    });
    console.log(`Widget embed key ${widgetResult.action}.`);
    if (widgetResult.secret) {
      console.log(`  ${widgetResult.secret}`);
      console.log('  Must match VITE_WIDGET_API_KEY in resources/client build env.');
    }
  } else {
    console.warn(
      'MAKO_WIDGET_API_KEY not set in .env — enabling widget and keeping/creating a key without syncing a fixed secret.',
    );
    console.warn('Add to .env: MAKO_WIDGET_API_KEY=pk_live_... (same as VITE_WIDGET_API_KEY) and re-run seed:prod');
    const widgetResult = await widgetSeed.ensureSeededForTenant(makoTenant.id);
    console.log(`Widget embed: ${widgetResult.action}`);
    if (widgetResult.secret) {
      console.log(`  Generated key: ${widgetResult.secret}`);
      console.log('  Set this as VITE_WIDGET_API_KEY in resources/client and MAKO_WIDGET_API_KEY in .env');
    }
  }

  console.log('\nProduction seed complete.');
  await app.close();
}

bootstrap().catch((err) => {
  console.error('Production seed failed:', err);
  process.exit(1);
});
