import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAdsTables1783188236771 implements MigrationInterface {
  name = 'CreateAdsTables1783188236771';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "ad_campaigns_platform_enum" AS ENUM (
          'META', 'GOOGLE', 'EMBED', 'TIKTOK', 'LINKEDIN', 'PINTEREST', 'TABOOLA', 'X'
        );
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "ad_campaigns_status_enum" AS ENUM (
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
      ALTER TABLE tenants
        ADD COLUMN IF NOT EXISTS ads_balance numeric(10, 2) NOT NULL DEFAULT 0
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS ad_creatives`);
    await queryRunner.query(`DROP TABLE IF EXISTS ad_campaigns`);
    await queryRunner.query(`
      ALTER TABLE tenants DROP COLUMN IF EXISTS ads_balance
    `);
    await queryRunner.query(`DROP TYPE IF EXISTS ad_campaigns_status_enum`);
    await queryRunner.query(`DROP TYPE IF EXISTS ad_campaigns_platform_enum`);
  }
}
