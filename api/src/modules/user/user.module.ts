import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserController } from './user.controller';
import { UserEntity } from './user.entity';
import { UserService } from './user.service';
import { DevicePushTokenEntity } from './device-push-token.entity';

@Module({
  imports: [TypeOrmModule.forFeature([UserEntity, DevicePushTokenEntity])],
  controllers: [UserController],
  exports: [UserService],
  providers: [UserService],
})
export class UserModule {}
