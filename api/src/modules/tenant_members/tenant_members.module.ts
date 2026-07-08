import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TenantMembers } from './entities/tenant_members.entity';
import { TenantMemberInvitation } from './entities/tenant_member_invitation.entity';
import { TenantMembersService } from './tenant_members.service';
import { TenantMembersController } from './tenant_members.controller';
import { Profiles } from '../profiles/entities/profiles.entity';
import { Tenants } from '../tenants/entities/tenants.entity';
import { UserModule } from '../user/user.module';
import { MailModule } from '../mail/mail.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      TenantMembers,
      TenantMemberInvitation,
      Profiles,
      Tenants,
    ]),
    UserModule,
    MailModule,
  ],
  providers: [TenantMembersService],
  controllers: [TenantMembersController],
  exports: [TenantMembersService],
})
export class TenantMembersModule {}
