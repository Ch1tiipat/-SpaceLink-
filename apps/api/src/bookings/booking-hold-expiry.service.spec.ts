import { Test, type TestingModule } from '@nestjs/testing';
import { BookingStatus, CancelledByRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { BookingHoldExpiryService } from './booking-hold-expiry.service';

const NOW = new Date('2026-08-02T12:00:00.000Z');
const bookingUpdateMany = jest.fn();
const mockPrismaService = {
  booking: { updateMany: bookingUpdateMany },
};

describe('BookingHoldExpiryService', () => {
  let service: BookingHoldExpiryService;

  beforeEach(async () => {
    jest.useFakeTimers();
    jest.setSystemTime(NOW);
    jest.clearAllMocks();
    bookingUpdateMany.mockResolvedValue({ count: 2 });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookingHoldExpiryService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get(BookingHoldExpiryService);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('cancels only expired pending-payment bookings as the system', async () => {
    await expect(service.cancelExpiredHolds()).resolves.toBe(2);

    expect(bookingUpdateMany).toHaveBeenCalledWith({
      where: {
        status: BookingStatus.PENDING_PAYMENT,
        holdExpiresAt: { lt: NOW },
      },
      data: {
        status: BookingStatus.CANCELLED,
        cancelledByRole: CancelledByRole.SYSTEM,
        cancelledAt: NOW,
      },
    });
  });

  it('returns zero when no payment holds have expired', async () => {
    bookingUpdateMany.mockResolvedValue({ count: 0 });

    await expect(service.cancelExpiredHolds()).resolves.toBe(0);
  });

  it('does not hide a database failure', async () => {
    bookingUpdateMany.mockRejectedValue(new Error('database unavailable'));

    await expect(service.cancelExpiredHolds()).rejects.toThrow(
      'database unavailable',
    );
  });
});
