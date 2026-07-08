import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLogs } from './entities/audit_logs.entity';
import { AuditLogsService } from './audit_logs.service';
import { AuditLogsController } from './audit_logs.controller';

@Module({
  imports: [TypeOrmModule.forFeature([AuditLogs])],
  providers: [AuditLogsService],
  controllers: [AuditLogsController],
  exports: [AuditLogsService],
})
export class AuditLogsModule {}
