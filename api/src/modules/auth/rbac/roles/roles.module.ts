import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Roles } from './entities/roles.entity';
import { RolesService } from './roles.service';
import { RolesController } from './roles.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Roles])],
  providers: [RolesService],
  controllers: [RolesController],
  exports: [RolesService],
})
export class RolesModule {}
