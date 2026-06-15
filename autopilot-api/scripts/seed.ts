import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { TenantBootstrapService } from '../src/modules/tenants/tenant-bootstrap.service';
import { UserService } from '../src/modules/user/user.service';
import { Profiles } from '../src/modules/profiles/entities/profiles.entity';
import { RoleType } from '../src/constants';

/**
 * Run: npm run seed:dev
 */
async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['log', 'error', 'warn'],
  });

  const bootstrapService = app.get(TenantBootstrapService);
  const userService = app.get(UserService);
  const dataSource = app.get(DataSource);
  const profilesRepo = dataSource.getRepository(Profiles);
  const { TemplateSeedService } = await import('../src/modules/templates/template-seed.service');
  const { Tenants } = await import('../src/modules/tenants/entities/tenants.entity');
  const templateSeeds = app.get(TemplateSeedService);
  const tenantsRepo = dataSource.getRepository(Tenants);

  console.log('Seeding permissions...');
  await bootstrapService.ensurePermissionsSeeded();
  console.log('Permissions seeded.');

  const { SystemSettingsService, DEFAULT_THEME } = await import('../src/modules/system_settings/system_settings.service');
  const settingsService = app.get(SystemSettingsService);
  await settingsService.upsert('theme', {
    value: DEFAULT_THEME,
    description: 'Global UI theme (HSL values without hsl() wrapper)',
  });
  console.log('Default theme seeded.');

  const { PlansSeedService } = await import('../src/modules/subscriptions/plans-seed.service');
  const plansSeed = app.get(PlansSeedService);
  const plansResult = await plansSeed.ensureSeeded();
  console.log(`Billing plans ${plansResult}.`);

  const demoUsers: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    role: RoleType;
    isSystemAdmin: boolean;
  }[] = [
    {
      email: 'superadmin@mako.test',
      password: 'password123',
      firstName: 'Mako',
      lastName: 'Market Co-pilot',
      role: RoleType.SUPER_ADMIN,
      isSystemAdmin: true,
    },
    {
      email: 'owner@brandpilot.test',
      password: 'password123',
      firstName: 'Demo',
      lastName: 'Owner',
      role: RoleType.USER,
      isSystemAdmin: false,
    },
    {
      email: 'admin@brandpilot.test',
      password: 'password123',
      firstName: 'Demo',
      lastName: 'Admin',
      role: RoleType.ADMIN,
      isSystemAdmin: false,
    },
    {
      email: 'creator@brandpilot.test',
      password: 'password123',
      firstName: 'Demo',
      lastName: 'Creator',
      role: RoleType.USER,
      isSystemAdmin: false,
    },
  ];

  for (const demo of demoUsers) {
    let user = await userService.findOne({ email: demo.email });
    if (!user) {
      user = await userService.createUser({
        email: demo.email,
        password: demo.password,
        firstName: demo.firstName,
        lastName: demo.lastName,
        provider: 'local',
      });
      console.log(`Created demo user: ${demo.email}`);
    } else {
      console.log(`Demo user exists: ${demo.email}`);
    }

    await bootstrapService.bootstrapForUser(user);

    if (user.role !== demo.role) {
      user.role = demo.role;
      await userService.save(user);
      console.log(`Set ${demo.email} role to ${demo.role}`);
    }

    const profile = await profilesRepo.findOne({ where: { userId: user.id } });
    if (profile) {
      if (demo.isSystemAdmin && !profile.isSystemAdmin) {
        profile.isSystemAdmin = true;
        await profilesRepo.save(profile);
        console.log(`Promoted ${demo.email} to Super Admin`);
      } else if (!demo.isSystemAdmin && profile.isSystemAdmin) {
        profile.isSystemAdmin = false;
        await profilesRepo.save(profile);
        console.log(`Removed Super Admin from ${demo.email}`);
      }
    }
  }

  console.log('Seeding tenant defaults for all tenants...');
  const allTenants = await tenantsRepo.find({ select: ['id', 'ownerId'] });
  const { AutoReplySeedService } = await import('../src/modules/auto_reply_rules/auto-reply-seed.service');
  const autoReplySeeds = app.get(AutoReplySeedService);
  const { UserEntity } = await import('../src/modules/user/user.entity');
  const usersRepo = dataSource.getRepository(UserEntity);

  for (const tenant of allTenants) {
    if (tenant.ownerId) {
      await templateSeeds.ensureSeededForTenant(tenant.id, tenant.ownerId);
      await autoReplySeeds.ensureSeededForTenant(tenant.id);
      const owner = await usersRepo.findOne({ where: { id: tenant.ownerId } });
      if (owner) {
        const { BrandProfileSeedService } = await import('../src/modules/brand_profiles/brand-profile-seed.service');
        const brandProfileSeeds = app.get(BrandProfileSeedService);
        await brandProfileSeeds.ensureStarterForUser(tenant.id, owner);
      }
    }
  }
  console.log(`Tenant defaults seeded for ${allTenants.length} tenant(s).`);

  const ownerUser = await usersRepo.findOne({ where: { email: 'owner@brandpilot.test' } });
  if (ownerUser) {
    const ownerTenant = await tenantsRepo.findOne({ where: { ownerId: ownerUser.id } });
    if (ownerTenant) {
      const { ChatbotWidgetSeedService } = await import(
        '../src/modules/chatbot/chatbot-widget-seed.service'
      );
      const widgetSeed = app.get(ChatbotWidgetSeedService);
      const widgetResult = await widgetSeed.ensureSeededForTenant(ownerTenant.id);
      if (widgetResult.secret) {
        console.log(`\nWidget embed key (${widgetResult.action}):`);
        console.log(`  ${widgetResult.secret}`);
        console.log('  Set VITE_WIDGET_API_KEY in resources/client/.env to this value.');
      } else {
        console.log(`\nWidget embed: ${widgetResult.action} (existing key in database).`);
      }
    }
  }

  console.log('\nSeed complete.');
  console.log('Demo accounts (password: password123):');
  demoUsers.forEach((u) => console.log(`  - ${u.email}`));

  await app.close();
}

bootstrap().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
