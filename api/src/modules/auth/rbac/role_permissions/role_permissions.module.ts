import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RolePermissions } from './entities/role_permissions.entity';
import { RolePermissionsService } from './role_permissions.service';
import { RolePermissionsController } from './role_permissions.controller';

@Module({
  imports: [TypeOrmModule.forFeature([RolePermissions])],
  providers: [RolePermissionsService],
  controllers: [RolePermissionsController],
  exports: [RolePermissionsService],
})
export class RolePermissionsModule {}
