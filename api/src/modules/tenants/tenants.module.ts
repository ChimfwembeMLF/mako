import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Tenants } from './entities/tenants.entity';
import { TenantsService } from './tenants.service';
import { TenantsController } from './tenants.controller';
import { TenantBootstrapService } from './tenant-bootstrap.service';
import { Profiles } from '../profiles/entities/profiles.entity';
import { TenantMembers } from '../tenant_members/entities/tenant_members.entity';
import { Roles } from '../auth/rbac/roles/entities/roles.entity';
import { Permissions } from '../auth/rbac/permissions/entities/permissions.entity';
import { RolePermissions } from '../auth/rbac/role_permissions/entities/role_permissions.entity';
import { Workspaces } from '../workspaces/entities/workspaces.entity';
import { ApprovalWorkflows } from '../approval_workflows/entities/approval_workflows.entity';
import { UserEntity } from '../user/user.entity';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { TemplatesModule } from '../templates/templates.module';
import { AutoReplyRulesModule } from '../auto_reply_rules/auto_reply_rules.module';
import { BrandProfilesModule } from '../brand_profiles/brand_profiles.module';

@Module({
  imports: [
    SubscriptionsModule,
    TemplatesModule,
    AutoReplyRulesModule,
    BrandProfilesModule,
    TypeOrmModule.forFeature([
      Tenants,
      Profiles,
      TenantMembers,
      Roles,
      Permissions,
      RolePermissions,
      Workspaces,
      ApprovalWorkflows,
      UserEntity,
    ]),
  ],
  providers: [TenantsService, TenantBootstrapService],
  controllers: [TenantsController],
  exports: [TenantsService, TenantBootstrapService],
})
export class TenantsModule {}
