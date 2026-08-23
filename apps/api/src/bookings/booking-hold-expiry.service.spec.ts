import { Test, type TestingModule } from '@nestjs/testing';
import {
  BookingStatus,
  CancelledByRole,
  NotificationType,
} from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { BookingHoldExpiryService } from './booking-hold-expiry.service';

const NOW = new Date('2026-08-02T12:00:00.000Z');
const EXPIRED_BOOKINGS = [
  { id: 'booking-1', vendorUserId: 'vendor-1' },
  { id: 'booking-2', vendorUserId: 'vendor-2' },
];
const bookingFindMany = jest.fn();
const bookingUpdateMany = jest.fn();
const createForUser = jest.fn();
const mockPrismaService = {
  booking: {
    findMany: bookingFindMany,
    updateMany: bookingUpdateMany,
  },
};
const mockNotificationsService = { createForUser };

describe('BookingHoldExpiryService', () => {
  let service: BookingHoldExpiryService;

  beforeEach(async () => {
    jest.useFakeTimers();
    jest.setSystemTime(NOW);
    jest.clearAllMocks();
    bookingFindMany.mockResolvedValue(EXPIRED_BOOKINGS);
    bookingUpdateMany.mockResolvedValue({ count: 1 });
    createForUser.mockResolvedValue({});

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookingHoldExpiryService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: NotificationsService, useValue: mockNotificationsService },
      ],
    }).compile();

    service = module.get(BookingHoldExpiryService);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('cancels expired pending-payment bookings and notifies each vendor', async () => {
    await expect(service.cancelExpiredHolds()).resolves.toBe(2);

    expect(bookingFindMany).toHaveBeenCalledWith({
      where: {
        status: BookingStatus.PENDING_PAYMENT,
        holdExpiresAt: { lt: NOW },
      },
      select: {
        id: true,
        vendorUserId: true,
      },
    });

    for (const booking of EXPIRED_BOOKINGS) {
      expect(bookingUpdateMany).toHaveBeenCalledWith({
        where: {
          id: booking.id,
          status: BookingStatus.PENDING_PAYMENT,
          holdExpiresAt: { lt: NOW },
        },
        data: {
          status: BookingStatus.CANCELLED,
          cancelledByRole: CancelledByRole.SYSTEM,
          cancelledAt: NOW,
        },
      });
      expect(createForUser).toHaveBeenCalledWith(booking.vendorUserId, {
        type: NotificationType.PAYMENT,
        title: 'การจองถูกยกเลิกเพราะไม่ชำระเงินทันเวลา',
        body: 'ระบบคืนบูธให้ผู้ใช้อื่นแล้ว คุณสามารถเลือกบูธและสร้างการจองใหม่ได้',
        relatedEntityType: 'BOOKING',
        relatedEntityId: booking.id,
      });
    }
  });

  it('returns zero when no payment holds have expired', async () => {
    bookingFindMany.mockResolvedValue([]);

    await expect(service.cancelExpiredHolds()).resolves.toBe(0);
    expect(bookingUpdateMany).not.toHaveBeenCalled();
    expect(createForUser).not.toHaveBeenCalled();
  });

  it('does not notify when another cron instance already cancelled the hold', async () => {
    bookingFindMany.mockResolvedValue([EXPIRED_BOOKINGS[0]]);
    bookingUpdateMany.mockResolvedValue({ count: 0 });

    await expect(service.cancelExpiredHolds()).resolves.toBe(0);
    expect(createForUser).not.toHaveBeenCalled();
  });

  it('keeps the cancellation successful when best-effort notification returns null', async () => {
    bookingFindMany.mockResolvedValue([EXPIRED_BOOKINGS[0]]);
    createForUser.mockResolvedValue(null);

    await expect(service.cancelExpiredHolds()).resolves.toBe(1);
    expect(createForUser).toHaveBeenCalledTimes(1);
  });

  it('does not hide a database failure', async () => {
    bookingFindMany.mockRejectedValue(new Error('database unavailable'));

    await expect(service.cancelExpiredHolds()).rejects.toThrow(
      'database unavailable',
    );
  });
});
