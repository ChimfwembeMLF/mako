import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Workspaces } from './entities/workspaces.entity';
import { WorkspaceAutomationConfig } from './entities/workspace-automation-config.entity';
import { WorkspacesService } from './workspaces.service';
import { WorkspacesController } from './workspaces.controller';
import { BrandProfilesModule } from '../brand_profiles/brand_profiles.module';
import { TemplatesModule } from '../templates/templates.module';
import { AutoReplyRulesModule } from '../auto_reply_rules/auto_reply_rules.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Workspaces, WorkspaceAutomationConfig]),
    BrandProfilesModule,
    TemplatesModule,
    AutoReplyRulesModule,
  ],
  providers: [WorkspacesService],
  controllers: [WorkspacesController],
  exports: [WorkspacesService],
})
export class WorkspacesModule {}
