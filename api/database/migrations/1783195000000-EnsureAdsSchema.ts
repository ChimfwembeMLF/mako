import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Repairs environments where earlier ads migrations were stubs (no-op whatsapp edits).
 * Uses snake_case column names to match SnakeNamingStrategy / TypeORM synchronize.
 * Safe to run multiple times.
 */
export class EnsureAdsSchema1783195000000 implements MigrationInterface {
  name = 'EnsureAdsSchema1783195000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE ad_campaigns_platform_enum AS ENUM (
          'META', 'GOOGLE', 'EMBED', 'TIKTOK', 'LINKEDIN', 'PINTEREST', 'TABOOLA', 'X'
        );
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE ad_campaigns_status_enum AS ENUM (
          'DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED', 'FAILED'
        );
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS ad_campaigns (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id uuid NOT NULL,
        platform ad_campaigns_platform_enum NOT NULL DEFAULT 'META',
        platform_campaign_id varchar,
        name varchar NOT NULL,
        status ad_campaigns_status_enum NOT NULL DEFAULT 'DRAFT',
        daily_budget numeric(10, 2) NOT NULL DEFAULT 0,
        target_audience varchar,
        target_url varchar,
        location varchar,
        start_date date,
        end_date date,
        age_range varchar,
        native_impressions integer NOT NULL DEFAULT 0,
        native_clicks integer NOT NULL DEFAULT 0,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      ALTER TABLE ad_campaigns
        ADD COLUMN IF NOT EXISTS tenant_id uuid,
        ADD COLUMN IF NOT EXISTS platform ad_campaigns_platform_enum DEFAULT 'META',
        ADD COLUMN IF NOT EXISTS platform_campaign_id varchar,
        ADD COLUMN IF NOT EXISTS status ad_campaigns_status_enum DEFAULT 'DRAFT',
        ADD COLUMN IF NOT EXISTS daily_budget numeric(10, 2) DEFAULT 0,
        ADD COLUMN IF NOT EXISTS target_audience varchar,
        ADD COLUMN IF NOT EXISTS target_url varchar,
        ADD COLUMN IF NOT EXISTS location varchar,
        ADD COLUMN IF NOT EXISTS start_date date,
        ADD COLUMN IF NOT EXISTS end_date date,
        ADD COLUMN IF NOT EXISTS age_range varchar,
        ADD COLUMN IF NOT EXISTS native_impressions integer DEFAULT 0,
        ADD COLUMN IF NOT EXISTS native_clicks integer DEFAULT 0,
        ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now(),
        ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now()
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_ad_campaigns_tenant"
        ON ad_campaigns (tenant_id, created_at DESC)
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS ad_creatives (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        campaign_id uuid NOT NULL REFERENCES ad_campaigns(id) ON DELETE CASCADE,
        headline text NOT NULL,
        body text NOT NULL,
        media_url varchar,
        is_published boolean NOT NULL DEFAULT false,
        platform_ad_id varchar,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      ALTER TABLE ad_creatives
        ADD COLUMN IF NOT EXISTS campaign_id uuid,
        ADD COLUMN IF NOT EXISTS headline text,
        ADD COLUMN IF NOT EXISTS body text,
        ADD COLUMN IF NOT EXISTS media_url varchar,
        ADD COLUMN IF NOT EXISTS is_published boolean DEFAULT false,
        ADD COLUMN IF NOT EXISTS platform_ad_id varchar,
        ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now(),
        ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now()
    `);

    await queryRunner.query(`
      ALTER TABLE tenants
        ADD COLUMN IF NOT EXISTS ads_balance numeric(10, 2) NOT NULL DEFAULT 0
    `);
  }

  public async down(): Promise<void> {
    // Forward-only repair migration.
  }
}
