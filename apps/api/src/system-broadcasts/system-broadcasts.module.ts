import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { SystemBroadcastsController } from './system-broadcasts.controller';
import { SystemBroadcastsService } from './system-broadcasts.service';

@Module({
  imports: [NotificationsModule],
  controllers: [SystemBroadcastsController],
  providers: [SystemBroadcastsService],
})
export class SystemBroadcastsModule {}
