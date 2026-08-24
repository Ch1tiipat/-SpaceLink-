import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { NotificationsModule } from '../notifications/notifications.module';
import { SlipsModule } from '../slips/slips.module';
import { BookingHoldExpiryService } from './booking-hold-expiry.service';
import { BookingSlipStorageService } from './booking-slip-storage.service';
import { BookingsService } from './bookings.service';
import { BookingsController } from './bookings.controller';
import { OrganizationBookingsController } from './organization-bookings.controller';

@Module({
  imports: [ScheduleModule.forRoot(), SlipsModule, NotificationsModule],
  controllers: [BookingsController, OrganizationBookingsController],
  providers: [
    BookingsService,
    BookingSlipStorageService,
    BookingHoldExpiryService,
  ],
  exports: [BookingsService],
})
export class BookingsModule {}
