import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Older publications didn't record which social account posted them, so the Social
 * accounts page showed "no posts yet". Fill it in only where there's no doubt: the
 * organization had exactly one account for that platform in that workspace.
 * Publications where several accounts could have posted are left blank.
 */
export class BackfillPublicationAccounts1790600000000
  implements MigrationInterface
{
  name = 'BackfillPublicationAccounts1790600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE content_publications p
         SET social_account_id = s.id
        FROM (
          SELECT tenant_id, workspace_id, platform, (array_agg(id))[1] AS id
            FROM social_accounts
           GROUP BY tenant_id, workspace_id, platform
          HAVING count(*) = 1
        ) s
       WHERE p.social_account_id IS NULL
         AND s.tenant_id = p.tenant_id
         AND s.workspace_id IS NOT DISTINCT FROM p.workspace_id
         AND s.platform = p.platform
    `);
  }

  public async down(): Promise<void> {
    // Nothing to undo safely: the filled-in ids are indistinguishable from recorded ones.
  }
}
