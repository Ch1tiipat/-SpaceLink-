import { Module } from '@nestjs/common';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { UserLastLoginService } from './user-last-login.service';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';

@Module({
  imports: [AuditLogsModule],
  controllers: [UsersController],
  providers: [UsersService, UserLastLoginService],
})
export class UsersModule {}
