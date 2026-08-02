import { Module } from '@nestjs/common';
import { SlipsModule } from '../slips/slips.module';
import { BookingSlipStorageService } from './booking-slip-storage.service';
import { BookingsService } from './bookings.service';
import { BookingsController } from './bookings.controller';

@Module({
  imports: [SlipsModule],
  controllers: [BookingsController],
  providers: [BookingsService, BookingSlipStorageService],
})
export class BookingsModule {}
