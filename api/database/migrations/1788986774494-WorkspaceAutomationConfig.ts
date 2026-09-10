import { MigrationInterface, QueryRunner } from "typeorm";

export class WorkspaceAutomationConfig1788986774494 implements MigrationInterface {
    name = 'WorkspaceAutomationConfig1788986774494'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "mail_messages" DROP CONSTRAINT "mail_messages_rule_id_fkey"`);
        await queryRunner.query(`ALTER TABLE "mail_messages" DROP CONSTRAINT "mail_messages_workspace_id_fkey"`);
        await queryRunner.query(`ALTER TABLE "mail_messages" DROP CONSTRAINT "mail_messages_user_id_fkey"`);
        await queryRunner.query(`ALTER TABLE "mail_messages" DROP CONSTRAINT "mail_messages_tenant_id_fkey"`);
        await queryRunner.query(`ALTER TABLE "gmail_inbox_connections" DROP CONSTRAINT "gmail_inbox_connections_workspace_id_fkey"`);
        await queryRunner.query(`ALTER TABLE "gmail_inbox_connections" DROP CONSTRAINT "gmail_inbox_connections_user_id_fkey"`);
        await queryRunner.query(`ALTER TABLE "gmail_inbox_connections" DROP CONSTRAINT "gmail_inbox_connections_tenant_id_fkey"`);
        await queryRunner.query(`DROP INDEX "public"."UQ_mail_messages_gmail_message_id"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_mail_messages_tenant_created"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_mail_messages_tenant_status_created"`);
        await queryRunner.query(`DROP INDEX "public"."UQ_gmail_inbox_connections_tenant_user"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_gmail_inbox_connections_active"`);
        await queryRunner.query(`CREATE TABLE "workspace_automation_configs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "workspace_id" uuid NOT NULL, "is_active" boolean NOT NULL DEFAULT false, "timezone" text NOT NULL DEFAULT 'America/New_York', "generate_at" text NOT NULL DEFAULT '19:00', "posts_per_cycle" integer NOT NULL DEFAULT '3', "plan_ahead_days" integer NOT NULL DEFAULT '1', "publishing_days" jsonb NOT NULL DEFAULT '[]', "posting_times" jsonb NOT NULL DEFAULT '[]', "platforms" jsonb NOT NULL DEFAULT '[]', "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_531d1e5e5c98f88f69c50c4c3d7" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "refund_requests" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenant_id" uuid NOT NULL, "deposit_id" uuid NOT NULL, "amount" numeric(10,2) NOT NULL, "reason" text NOT NULL, "status" text NOT NULL DEFAULT 'PENDING', "admin_notes" text, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "tenantId" uuid, "depositId" uuid, CONSTRAINT "PK_00c88ecd40a63abe92a3dc69897" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "social_insights" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenant_id" uuid NOT NULL, "workspace_id" uuid, "social_account_id" uuid NOT NULL, "date" date NOT NULL, "followers_count" integer NOT NULL DEFAULT '0', "reach" integer NOT NULL DEFAULT '0', "impressions" integer NOT NULL DEFAULT '0', "engagement" integer NOT NULL DEFAULT '0', "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "tenantId" uuid NOT NULL, "socialAccountId" uuid NOT NULL, CONSTRAINT "PK_aa249502266e94b0c670f9bfbed" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "device_push_tokens" ADD "device_name" character varying`);
        await queryRunner.query(`ALTER TABLE "whatsapp_flow_configs" ALTER COLUMN "welcome_triggers" SET DEFAULT ARRAY['hi','hello','menu','start','0']`);
        await queryRunner.query(`ALTER TABLE "device_push_tokens" DROP CONSTRAINT "PK_370bb846d0802f3c6b577be3f43"`);
        await queryRunner.query(`ALTER TABLE "device_push_tokens" DROP COLUMN "id"`);
        await queryRunner.query(`ALTER TABLE "device_push_tokens" ADD "id" SERIAL NOT NULL`);
        await queryRunner.query(`ALTER TABLE "device_push_tokens" ADD CONSTRAINT "PK_370bb846d0802f3c6b577be3f43" PRIMARY KEY ("id")`);
        await queryRunner.query(`ALTER TABLE "device_push_tokens" ALTER COLUMN "platform" DROP NOT NULL`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_8318d76f87aa2f879d3f779560" ON "mail_messages" ("gmail_message_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_c4554e074d0e7a9375171f1761" ON "mail_messages" ("tenant_id", "created_at") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_dcd2cac98c13ca94a35ee037d0" ON "gmail_inbox_connections" ("tenant_id", "user_id") `);
        await queryRunner.query(`ALTER TABLE "workspace_automation_configs" ADD CONSTRAINT "FK_8fa92429c66dddfe83d1d9840e5" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "refund_requests" ADD CONSTRAINT "FK_1df7b848314df96cdaf22855178" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "refund_requests" ADD CONSTRAINT "FK_12bb67008f17cdbb6cd7ba558a1" FOREIGN KEY ("depositId") REFERENCES "deposits"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "mail_messages" ADD CONSTRAINT "FK_68d7cfcbcaca4560e61259f3c0c" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "gmail_inbox_connections" ADD CONSTRAINT "FK_a0fb2250980ec02d11284851359" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "gmail_inbox_connections" ADD CONSTRAINT "FK_55e7d5813f776336a6291ec733c" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "social_insights" ADD CONSTRAINT "FK_cf8022ff181a8ceba4b11a4496c" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "social_insights" ADD CONSTRAINT "FK_29f8991bf0f9725eeb3679aa5cd" FOREIGN KEY ("socialAccountId") REFERENCES "social_accounts"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "social_insights" DROP CONSTRAINT "FK_29f8991bf0f9725eeb3679aa5cd"`);
        await queryRunner.query(`ALTER TABLE "social_insights" DROP CONSTRAINT "FK_cf8022ff181a8ceba4b11a4496c"`);
        await queryRunner.query(`ALTER TABLE "gmail_inbox_connections" DROP CONSTRAINT "FK_55e7d5813f776336a6291ec733c"`);
        await queryRunner.query(`ALTER TABLE "gmail_inbox_connections" DROP CONSTRAINT "FK_a0fb2250980ec02d11284851359"`);
        await queryRunner.query(`ALTER TABLE "mail_messages" DROP CONSTRAINT "FK_68d7cfcbcaca4560e61259f3c0c"`);
        await queryRunner.query(`ALTER TABLE "refund_requests" DROP CONSTRAINT "FK_12bb67008f17cdbb6cd7ba558a1"`);
        await queryRunner.query(`ALTER TABLE "refund_requests" DROP CONSTRAINT "FK_1df7b848314df96cdaf22855178"`);
        await queryRunner.query(`ALTER TABLE "workspace_automation_configs" DROP CONSTRAINT "FK_8fa92429c66dddfe83d1d9840e5"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_dcd2cac98c13ca94a35ee037d0"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_c4554e074d0e7a9375171f1761"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_8318d76f87aa2f879d3f779560"`);
        await queryRunner.query(`ALTER TABLE "device_push_tokens" ALTER COLUMN "platform" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "device_push_tokens" DROP CONSTRAINT "PK_370bb846d0802f3c6b577be3f43"`);
        await queryRunner.query(`ALTER TABLE "device_push_tokens" DROP COLUMN "id"`);
        await queryRunner.query(`ALTER TABLE "device_push_tokens" ADD "id" uuid NOT NULL DEFAULT uuid_generate_v4()`);
        await queryRunner.query(`ALTER TABLE "device_push_tokens" ADD CONSTRAINT "PK_370bb846d0802f3c6b577be3f43" PRIMARY KEY ("id")`);
        await queryRunner.query(`ALTER TABLE "whatsapp_flow_configs" ALTER COLUMN "welcome_triggers" SET DEFAULT ARRAY['hi', 'hello', 'menu', 'start', '0'`);
        await queryRunner.query(`ALTER TABLE "device_push_tokens" DROP COLUMN "device_name"`);
        await queryRunner.query(`DROP TABLE "social_insights"`);
        await queryRunner.query(`DROP TABLE "refund_requests"`);
        await queryRunner.query(`DROP TABLE "workspace_automation_configs"`);
        await queryRunner.query(`CREATE INDEX "IDX_gmail_inbox_connections_active" ON "gmail_inbox_connections" ("last_synced_at", "is_active") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "UQ_gmail_inbox_connections_tenant_user" ON "gmail_inbox_connections" ("tenant_id", "user_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_mail_messages_tenant_status_created" ON "mail_messages" ("tenant_id", "status", "created_at") `);
        await queryRunner.query(`CREATE INDEX "IDX_mail_messages_tenant_created" ON "mail_messages" ("tenant_id", "created_at") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "UQ_mail_messages_gmail_message_id" ON "mail_messages" ("gmail_message_id") `);
        await queryRunner.query(`ALTER TABLE "gmail_inbox_connections" ADD CONSTRAINT "gmail_inbox_connections_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "gmail_inbox_connections" ADD CONSTRAINT "gmail_inbox_connections_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "gmail_inbox_connections" ADD CONSTRAINT "gmail_inbox_connections_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "mail_messages" ADD CONSTRAINT "mail_messages_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "mail_messages" ADD CONSTRAINT "mail_messages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "mail_messages" ADD CONSTRAINT "mail_messages_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "mail_messages" ADD CONSTRAINT "mail_messages_rule_id_fkey" FOREIGN KEY ("rule_id") REFERENCES "auto_reply_rules"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

}
