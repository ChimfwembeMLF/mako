import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AuditLogsModule } from '../../modules/audit_logs/audit_logs.module';
import { TenantMembers } from '../../modules/tenant_members/entities/tenant_members.entity';
import { AuditContextService } from './audit-context.service';
import { AuditInterceptor } from './audit.interceptor';

@Module({
  imports: [AuditLogsModule, TypeOrmModule.forFeature([TenantMembers])],
  providers: [
    AuditContextService,
    AuditInterceptor,
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditInterceptor,
    },
  ],
})
export class AuditModule {}
