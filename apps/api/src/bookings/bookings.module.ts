import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { SlipsModule } from '../slips/slips.module';
import { BookingHoldExpiryService } from './booking-hold-expiry.service';
import { BookingSlipStorageService } from './booking-slip-storage.service';
import { BookingsService } from './bookings.service';
import { BookingsController } from './bookings.controller';

@Module({
  imports: [ScheduleModule.forRoot(), SlipsModule],
  controllers: [BookingsController],
  providers: [
    BookingsService,
    BookingSlipStorageService,
    BookingHoldExpiryService,
  ],
  exports: [BookingsService],
})
export class BookingsModule {}
