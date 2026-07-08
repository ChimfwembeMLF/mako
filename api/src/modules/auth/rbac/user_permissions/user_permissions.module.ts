import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserPermissions } from './entities/user_permissions.entity';
import { UserPermissionsService } from './user_permissions.service';
import { UserPermissionsController } from './user_permissions.controller';

@Module({
  imports: [TypeOrmModule.forFeature([UserPermissions])],
  providers: [UserPermissionsService],
  controllers: [UserPermissionsController],
  exports: [UserPermissionsService],
})
export class UserPermissionsModule {}
