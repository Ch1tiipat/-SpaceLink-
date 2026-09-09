import { Test, type TestingModule } from '@nestjs/testing';
import {
  BookingStatus,
  CancelledByRole,
  NotificationType,
  PaymentGroupStatus,
  Prisma,
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
const paymentGroupFindMany = jest.fn();
const paymentGroupUpdateMany = jest.fn();
const prismaTransaction = jest.fn();
const createForUser = jest.fn();
const mockPrismaService = {
  booking: {
    findMany: bookingFindMany,
    updateMany: bookingUpdateMany,
  },
  bookingPaymentGroup: {
    findMany: paymentGroupFindMany,
    updateMany: paymentGroupUpdateMany,
  },
  $transaction: prismaTransaction,
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
    paymentGroupFindMany.mockResolvedValue([]);
    paymentGroupUpdateMany.mockResolvedValue({ count: 1 });
    prismaTransaction.mockImplementation(
      (operation: (client: Prisma.TransactionClient) => Promise<unknown>) =>
        operation(mockPrismaService as unknown as Prisma.TransactionClient),
    );
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
        paymentGroupId: null,
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
          paymentGroupId: null,
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

  it('atomically cancels every booking in an expired payment group', async () => {
    const group = {
      id: 'payment-group-1',
      paymentCode: 'PG-EXPIRED0001',
      vendorUserId: 'vendor-1',
      bookings: [{ id: 'booking-1' }, { id: 'booking-2' }],
    };
    paymentGroupFindMany.mockResolvedValue([group]);
    bookingFindMany.mockResolvedValue([]);
    bookingUpdateMany.mockResolvedValue({ count: 2 });

    await expect(service.cancelExpiredHolds()).resolves.toBe(2);

    expect(prismaTransaction).toHaveBeenCalledTimes(1);
    expect(paymentGroupUpdateMany).toHaveBeenCalledWith({
      where: {
        id: group.id,
        status: PaymentGroupStatus.PENDING_PAYMENT,
        holdExpiresAt: { lt: NOW },
        bookings: { every: { status: BookingStatus.PENDING_PAYMENT } },
      },
      data: {
        status: PaymentGroupStatus.CANCELLED,
        cancelledAt: NOW,
      },
    });
    expect(bookingUpdateMany).toHaveBeenCalledWith({
      where: {
        paymentGroupId: group.id,
        status: BookingStatus.PENDING_PAYMENT,
        holdExpiresAt: { lt: NOW },
      },
      data: {
        status: BookingStatus.CANCELLED,
        cancelledByRole: CancelledByRole.SYSTEM,
        cancelledAt: NOW,
      },
    });
    expect(createForUser).toHaveBeenCalledWith(group.vendorUserId, {
      type: NotificationType.PAYMENT,
      title: 'กลุ่มการจองถูกยกเลิกเพราะไม่ชำระเงินทันเวลา',
      body: 'PG-EXPIRED0001 หมดเวลาชำระเงิน ระบบคืนบูธ 2 รายการให้ผู้ใช้อื่นแล้ว',
      relatedEntityType: 'PAYMENT_GROUP',
      relatedEntityId: group.id,
    });
  });

  it('keeps the legacy ungrouped hold path independent from payment groups', async () => {
    paymentGroupFindMany.mockResolvedValue([]);
    bookingFindMany.mockResolvedValue([EXPIRED_BOOKINGS[0]]);

    await expect(service.cancelExpiredHolds()).resolves.toBe(1);

    expect(prismaTransaction).not.toHaveBeenCalled();
    expect(bookingUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ paymentGroupId: null }) as object,
      }),
    );
    expect(createForUser).toHaveBeenCalledWith(
      EXPIRED_BOOKINGS[0].vendorUserId,
      expect.objectContaining({
        relatedEntityType: 'BOOKING',
        relatedEntityId: EXPIRED_BOOKINGS[0].id,
      }) as object,
    );
  });

  it('does not cancel members when another worker already changed the group', async () => {
    paymentGroupFindMany.mockResolvedValue([
      {
        id: 'payment-group-1',
        paymentCode: 'PG-EXPIRED0001',
        vendorUserId: 'vendor-1',
        bookings: [{ id: 'booking-1' }],
      },
    ]);
    paymentGroupUpdateMany.mockResolvedValue({ count: 0 });
    bookingFindMany.mockResolvedValue([]);

    await expect(service.cancelExpiredHolds()).resolves.toBe(0);

    expect(bookingUpdateMany).not.toHaveBeenCalled();
    expect(createForUser).not.toHaveBeenCalled();
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
