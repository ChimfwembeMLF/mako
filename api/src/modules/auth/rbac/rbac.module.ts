import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TenantMembers } from '../../tenant_members/entities/tenant_members.entity';
import { Roles } from './roles/entities/roles.entity';
import { RolePermissions } from './role_permissions/entities/role_permissions.entity';
import { UserPermissions } from './user_permissions/entities/user_permissions.entity';
import { Profiles } from '../../profiles/entities/profiles.entity';
import { UserEntity } from '../../user/user.entity';
import { RbacController } from './rbac.controller';
import { RbacService } from './rbac.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      TenantMembers,
      Roles,
      RolePermissions,
      UserPermissions,
      Profiles,
      UserEntity,
    ]),
  ],
  controllers: [RbacController],
  providers: [RbacService],
  exports: [RbacService],
})
export class RbacModule {}
