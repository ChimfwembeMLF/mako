import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Workspaces } from './entities/workspaces.entity';
import { WorkspacesService } from './workspaces.service';
import { WorkspacesController } from './workspaces.controller';
import { BrandProfilesModule } from '../brand_profiles/brand_profiles.module';

@Module({
  imports: [TypeOrmModule.forFeature([Workspaces]), BrandProfilesModule],
  providers: [WorkspacesService],
  controllers: [WorkspacesController],
  exports: [WorkspacesService],
})
export class WorkspacesModule {}
