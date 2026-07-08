import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Move tenant-level brand profiles onto each tenant's first workspace and
 * remove auto-cloned duplicates on secondary workspaces (never edited).
 */
export class BrandProfileLegacyToWorkspace1717920000029 implements MigrationInterface {
  name = 'BrandProfileLegacyToWorkspace1717920000029';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE brand_profiles bp
      SET workspace_id = fw.workspace_id
      FROM (
        SELECT w.tenant_id, w.id AS workspace_id
        FROM workspaces w
        INNER JOIN (
          SELECT tenant_id, MIN(created_at) AS min_created
          FROM workspaces
          GROUP BY tenant_id
        ) first ON first.tenant_id = w.tenant_id AND first.min_created = w.created_at
      ) fw
      WHERE bp.workspace_id IS NULL
        AND bp.tenant_id = fw.tenant_id
        AND NOT EXISTS (
          SELECT 1 FROM brand_profiles x WHERE x.workspace_id = fw.workspace_id
        )
    `);

    await queryRunner.query(`
      UPDATE brand_profiles AS ws_bp
      SET
        company_name = COALESCE(NULLIF(ws_bp.company_name, w.name), leg.company_name),
        industry = COALESCE(ws_bp.industry, leg.industry),
        description = COALESCE(ws_bp.description, leg.description),
        services = COALESCE(ws_bp.services, leg.services),
        target_audience = COALESCE(ws_bp.target_audience, leg.target_audience),
        audience_pain_points = COALESCE(ws_bp.audience_pain_points, leg.audience_pain_points),
        tone_of_voice = COALESCE(ws_bp.tone_of_voice, leg.tone_of_voice),
        brand_personality = COALESCE(ws_bp.brand_personality, leg.brand_personality),
        current_offers = COALESCE(ws_bp.current_offers, leg.current_offers),
        unique_selling_points = COALESCE(ws_bp.unique_selling_points, leg.unique_selling_points),
        faqs = COALESCE(ws_bp.faqs, leg.faqs),
        case_studies = COALESCE(ws_bp.case_studies, leg.case_studies),
        banned_words = COALESCE(ws_bp.banned_words, leg.banned_words),
        banned_topics = COALESCE(ws_bp.banned_topics, leg.banned_topics),
        competitors = COALESCE(ws_bp.competitors, leg.competitors),
        keywords = COALESCE(ws_bp.keywords, leg.keywords),
        website_url = COALESCE(ws_bp.website_url, leg.website_url)
      FROM brand_profiles AS leg,
           workspaces AS w,
           (
             SELECT tenant_id, MIN(created_at) AS min_created
             FROM workspaces
             GROUP BY tenant_id
           ) AS fw
      WHERE w.id = ws_bp.workspace_id
        AND fw.tenant_id = w.tenant_id
        AND fw.min_created = w.created_at
        AND leg.workspace_id IS NULL
        AND leg.tenant_id = ws_bp.tenant_id
        AND leg.user_id = ws_bp.user_id
        AND ws_bp.workspace_id IS NOT NULL
        AND ws_bp.description IS NULL
        AND leg.description IS NOT NULL
    `);

    await queryRunner.query(`
      UPDATE content_items AS ci
      SET brand_profile_id = ws_bp.id
      FROM brand_profiles AS leg,
           brand_profiles AS ws_bp
      WHERE ci.brand_profile_id = leg.id
        AND leg.workspace_id IS NULL
        AND ws_bp.tenant_id = leg.tenant_id
        AND ws_bp.user_id = leg.user_id
        AND ws_bp.workspace_id IS NOT NULL
        AND (
          ws_bp.workspace_id = ci.workspace_id
          OR (
            ci.workspace_id IS NULL
            AND ws_bp.workspace_id = (
              SELECT w.id
              FROM workspaces w
              WHERE w.tenant_id = leg.tenant_id
              ORDER BY w.created_at ASC
              LIMIT 1
            )
          )
        )
    `);

    await queryRunner.query(`
      UPDATE chatbot_configs AS cc
      SET brand_profile_id = ws_bp.id
      FROM brand_profiles AS leg,
           brand_profiles AS ws_bp
      WHERE cc.brand_profile_id = leg.id
        AND leg.workspace_id IS NULL
        AND ws_bp.tenant_id = leg.tenant_id
        AND ws_bp.user_id = leg.user_id
        AND ws_bp.workspace_id IS NOT NULL
        AND (
          ws_bp.workspace_id = cc.workspace_id
          OR (
            cc.workspace_id IS NULL
            AND ws_bp.workspace_id = (
              SELECT w.id
              FROM workspaces w
              WHERE w.tenant_id = leg.tenant_id
              ORDER BY w.created_at ASC
              LIMIT 1
            )
          )
        )
    `);

    await queryRunner.query(`
      DELETE FROM brand_profiles bp
      WHERE bp.workspace_id IS NULL
        AND EXISTS (
          SELECT 1 FROM brand_profiles bp2
          WHERE bp2.tenant_id = bp.tenant_id
            AND bp2.user_id = bp.user_id
            AND bp2.workspace_id IS NOT NULL
        )
    `);

    await queryRunner.query(`
      WITH primary_profile AS (
        SELECT DISTINCT ON (bp.tenant_id)
          bp.tenant_id,
          bp.id AS profile_id,
          bp.description,
          bp.industry
        FROM brand_profiles bp
        INNER JOIN workspaces w ON w.id = bp.workspace_id
        INNER JOIN (
          SELECT tenant_id, MIN(created_at) AS min_created
          FROM workspaces
          GROUP BY tenant_id
        ) fw ON fw.tenant_id = w.tenant_id AND fw.min_created = w.created_at
        WHERE bp.workspace_id IS NOT NULL
      )
      DELETE FROM brand_profiles bp
      USING primary_profile pp
      WHERE bp.tenant_id = pp.tenant_id
        AND bp.id <> pp.profile_id
        AND bp.workspace_id IS NOT NULL
        AND bp.updated_at = bp.created_at
        AND bp.description IS NOT DISTINCT FROM pp.description
        AND bp.industry IS NOT DISTINCT FROM pp.industry
        AND bp.description IS NOT NULL
    `);
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // Non-reversible data cleanup
  }
}
