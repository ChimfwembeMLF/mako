import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TenantMembers } from './entities/tenant_members.entity';
import { TenantMembersService } from './tenant_members.service';
import { TenantMembersController } from './tenant_members.controller';
import { Profiles } from '../profiles/entities/profiles.entity';
import { UserModule } from '../user/user.module';

@Module({
  imports: [TypeOrmModule.forFeature([TenantMembers, Profiles]), UserModule],
  providers: [TenantMembersService],
  controllers: [TenantMembersController],
  exports: [TenantMembersService],
})
export class TenantMembersModule {}
