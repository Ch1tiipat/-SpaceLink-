import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { PushSenderService } from './push-sender.service';

@Module({
  controllers: [NotificationsController],
  providers: [NotificationsService, PushSenderService],
  exports: [NotificationsService, PushSenderService],
})
export class NotificationsModule {}
