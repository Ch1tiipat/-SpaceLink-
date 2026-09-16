import { BookingStatus } from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { UpdateBookingStatusDto } from './update-booking-status.dto';

describe('UpdateBookingStatusDto', () => {
  it.each([BookingStatus.NO_SHOW, BookingStatus.COMPLETED])(
    'accepts %s as an admin booking outcome',
    (status) => {
      const dto = plainToInstance(UpdateBookingStatusDto, { status });

      expect(validateSync(dto)).toHaveLength(0);
    },
  );

  it.each([
    BookingStatus.PENDING_PAYMENT,
    BookingStatus.CONFIRMED,
    BookingStatus.CANCELLED,
    'NO_SHOW_LATER',
    undefined,
  ])('rejects unsupported status %s', (status) => {
    const dto = plainToInstance(UpdateBookingStatusDto, { status });

    expect(validateSync(dto)).not.toHaveLength(0);
  });
});
