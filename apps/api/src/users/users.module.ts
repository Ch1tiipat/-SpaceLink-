import { Module } from '@nestjs/common';
import { UserLastLoginService } from './user-last-login.service';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';

@Module({
  controllers: [UsersController],
  providers: [UsersService, UserLastLoginService],
})
export class UsersModule {}
