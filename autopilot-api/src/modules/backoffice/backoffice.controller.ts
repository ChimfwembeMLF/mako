import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SuperAdminGuard } from '../auth/guards/super-admin.guard';
import { BackofficeService } from './backoffice.service';

@ApiTags('Backoffice')
@Controller('api/v1/backoffice')
@UseGuards(JwtAuthGuard, SuperAdminGuard)
@ApiBearerAuth()
export class BackofficeController {
  constructor(private readonly backoffice: BackofficeService) {}

  @Get('overview')
  overview() {
    return this.backoffice.getOverview();
  }

  @Get('tenants')
  tenants() {
    return this.backoffice.listTenants();
  }

  @Get('tenants/:id')
  tenantDetail(@Param('id') id: string) {
    return this.backoffice.getTenantDetail(id);
  }
}
