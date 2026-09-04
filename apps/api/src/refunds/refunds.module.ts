import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { RefundsController } from './refunds.controller';
import { RefundsService } from './refunds.service';
import { RefundReminderService } from './refund-reminder.service';

@Module({
  imports: [NotificationsModule],
  controllers: [RefundsController],
  providers: [RefundsService, RefundReminderService],
})
export class RefundsModule {}
