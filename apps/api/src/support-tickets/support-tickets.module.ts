import { Module } from '@nestjs/common';
import { BookingsModule } from '../bookings/bookings.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { SupportTicketsController } from './support-tickets.controller';
import { SupportTicketsService } from './support-tickets.service';

@Module({
  // BookingsService arrives through its own module's exports rather than being
  // re-provided here: a second instance would be a second BookingHoldExpiry
  // wiring and a second copy of the slip dependencies, and approving a quota
  // exception has to go through the same booking rules as everything else.
  imports: [BookingsModule, NotificationsModule],
  controllers: [SupportTicketsController],
  providers: [SupportTicketsService],
})
export class SupportTicketsModule {}
