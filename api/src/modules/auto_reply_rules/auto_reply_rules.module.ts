import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AutoReplyRules } from './entities/auto_reply_rules.entity';
import { Tenants } from '../tenants/entities/tenants.entity';
import { AutoReplyRulesService } from './auto_reply_rules.service';
import { AutoReplyRulesController } from './auto_reply_rules.controller';
import { AutoReplySeedService } from './auto-reply-seed.service';

@Module({
  imports: [TypeOrmModule.forFeature([AutoReplyRules, Tenants])],
  providers: [AutoReplyRulesService, AutoReplySeedService],
  controllers: [AutoReplyRulesController],
  exports: [AutoReplyRulesService, AutoReplySeedService],
})
export class AutoReplyRulesModule {}
