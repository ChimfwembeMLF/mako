import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ContentTemplates } from './entities/content_templates.entity';
import { TemplatesService } from './templates.service';
import { TemplatesController } from './templates.controller';
import { TemplateSeedService } from './template-seed.service';

@Module({
  imports: [TypeOrmModule.forFeature([ContentTemplates])],
  providers: [TemplatesService, TemplateSeedService],
  controllers: [TemplatesController],
  exports: [TemplatesService, TemplateSeedService],
})
export class TemplatesModule {}
