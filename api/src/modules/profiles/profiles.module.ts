import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Profiles } from './entities/profiles.entity';
import { ProfilesService } from './profiles.service';
import { ProfilesController } from './profiles.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Profiles])],
  providers: [ProfilesService],
  controllers: [ProfilesController],
  exports: [ProfilesService],
})
export class ProfilesModule {}
