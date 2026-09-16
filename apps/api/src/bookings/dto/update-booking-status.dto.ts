import { BookingStatus } from '@prisma/client';
import { IsIn } from 'class-validator';

const ADMIN_BOOKING_OUTCOMES = [
  BookingStatus.NO_SHOW,
  BookingStatus.COMPLETED,
] as const;

export class UpdateBookingStatusDto {
  @IsIn(ADMIN_BOOKING_OUTCOMES)
  status!: BookingStatus;
}
