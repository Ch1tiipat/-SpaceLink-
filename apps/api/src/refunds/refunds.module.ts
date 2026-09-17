import { Module } from '@nestjs/common';
import { BookingsModule } from '../bookings/bookings.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { SlipsModule } from '../slips/slips.module';
import { RefundsController } from './refunds.controller';
import { RefundsService } from './refunds.service';
import { RefundReminderService } from './refund-reminder.service';

@Module({
  imports: [BookingsModule, NotificationsModule, SlipsModule],
  controllers: [RefundsController],
  providers: [RefundsService, RefundReminderService],
})
export class RefundsModule {}
