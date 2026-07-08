import { MigrationInterface, QueryRunner } from 'typeorm';

export class BrandProfileWorkspace1717920000027 implements MigrationInterface {
  name = 'BrandProfileWorkspace1717920000027';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE brand_profiles
        ADD COLUMN IF NOT EXISTS workspace_id UUID NULL
    `);
    await queryRunner.query(`
      ALTER TABLE brand_profiles
        DROP CONSTRAINT IF EXISTS brand_profiles_workspace_id_fkey
    `);
    await queryRunner.query(`
      ALTER TABLE brand_profiles
        ADD CONSTRAINT brand_profiles_workspace_id_fkey
        FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_brand_profiles_tenant_user"
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS brand_profiles_tenant_user_legacy
        ON brand_profiles (tenant_id, user_id)
        WHERE workspace_id IS NULL
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS brand_profiles_workspace_unique
        ON brand_profiles (workspace_id)
        WHERE workspace_id IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS brand_profiles_workspace_unique`);
    await queryRunner.query(`DROP INDEX IF EXISTS brand_profiles_tenant_user_legacy`);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_brand_profiles_tenant_user"
        ON brand_profiles (tenant_id, user_id)
    `);
    await queryRunner.query(`
      ALTER TABLE brand_profiles
        DROP CONSTRAINT IF EXISTS brand_profiles_workspace_id_fkey
    `);
    await queryRunner.query(`
      ALTER TABLE brand_profiles
        DROP COLUMN IF EXISTS workspace_id
    `);
  }
}
