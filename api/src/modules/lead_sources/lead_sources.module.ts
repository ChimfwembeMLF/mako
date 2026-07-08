import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LeadSources } from './entities/lead_sources.entity';
import { LeadSourcesService } from './lead_sources.service';
import { LeadSourcesController } from './lead_sources.controller';

@Module({
  imports: [TypeOrmModule.forFeature([LeadSources])],
  providers: [LeadSourcesService],
  controllers: [LeadSourcesController],
  exports: [LeadSourcesService],
})
export class LeadSourcesModule {}
