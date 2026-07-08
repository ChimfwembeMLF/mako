import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Permissions } from './entities/permissions.entity';
import { PermissionsService } from './permissions.service';
import { PermissionsController } from './permissions.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Permissions])],
  providers: [PermissionsService],
  controllers: [PermissionsController],
  exports: [PermissionsService],
})
export class PermissionsModule {}
