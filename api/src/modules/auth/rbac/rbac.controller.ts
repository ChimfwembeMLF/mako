import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { RbacService } from './rbac.service';

@Controller('api/v1/rbac')
@ApiTags('RBAC')
export class RbacController {
  constructor(private readonly rbacService: RbacService) {}

  @Get('roles/check/:tenantId/:userId')
  @ApiOperation({ summary: 'Check if user has any of the given roles' })
  async hasRoles(
    @Param('tenantId') tenantId: string,
    @Param('userId') userId: string,
    @Query('roles') roles: string,
  ) {
    const requiredRoles =
      roles
        ?.split(',')
        .map((r) => r.trim())
        .filter(Boolean) ?? [];
    const hasRole = await this.rbacService.hasRoles(
      userId,
      tenantId,
      requiredRoles,
    );
    return { success: true, hasRole };
  }

  @Get('permissions/check/:tenantId/:userId')
  @ApiOperation({ summary: 'Check if user has a specific permission' })
  async hasPermission(
    @Param('tenantId') tenantId: string,
    @Param('userId') userId: string,
    @Query('permission') permission: string,
  ) {
    const hasPermission = await this.rbacService.hasPermission(
      userId,
      tenantId,
      permission,
    );
    return { success: true, hasPermission };
  }

  @Get('effective-permissions/:tenantId/:userId')
  @ApiOperation({
    summary: 'Get all effective permissions for a user in a tenant',
  })
  async getEffectivePermissions(
    @Param('tenantId') tenantId: string,
    @Param('userId') userId: string,
  ) {
    return this.rbacService.getEffectivePermissions(userId, tenantId);
  }
}
