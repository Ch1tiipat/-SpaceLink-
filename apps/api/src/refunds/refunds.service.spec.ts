import {
  BadRequestException,
  ConflictException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import {
  BookingStatus,
  NotificationType,
  Prisma,
  RefundStatus,
  SlipStatus,
} from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { RefundsService } from './refunds.service';

const VENDOR_ID = '11111111-1111-4111-8111-111111111111';
const ADMIN_ID = '22222222-2222-4222-8222-222222222222';
const OTHER_ADMIN_ID = '33333333-3333-4333-8333-333333333333';
const BOOKING_ID = '44444444-4444-4444-8444-444444444444';
const REFUND_ID = '55555555-5555-4555-8555-555555555555';
const ORGANIZATION_ID = '66666666-6666-4666-8666-666666666666';
const NOW = new Date('2026-08-23T08:00:00.000Z');
const BOOTH_PRICE = new Prisma.Decimal('1500');

const CREATE_DTO = {
  reason: 'ยกเลิกก่อนวันเริ่มงาน',
  requestedAmount: '1200',
};
const APPROVE_DTO = { approvedAmount: '1000' };

const REFUND = {
  id: REFUND_ID,
  bookingId: BOOKING_ID,
  requestedByUserId: VENDOR_ID,
  reason: CREATE_DTO.reason,
  requestedAmount: new Prisma.Decimal(CREATE_DTO.requestedAmount),
  approvedAmount: null,
  status: RefundStatus.PENDING,
  evidenceUrls: null,
  reviewedByUserId: null,
  reviewedAt: null,
  processedAt: null,
  createdAt: NOW,
  updatedAt: NOW,
};

const bookingFindFirst = jest.fn();
const refundRequestFindFirst = jest.fn();
const refundRequestFindMany = jest.fn();
const refundRequestCreate = jest.fn();
const refundRequestUpdateMany = jest.fn();
const orgMembershipFindMany = jest.fn();
const prismaTransaction = jest.fn();
const createForUser = jest.fn();

const mockPrismaService = {
  booking: { findFirst: bookingFindFirst },
  refundRequest: {
    findFirst: refundRequestFindFirst,
    findMany: refundRequestFindMany,
    create: refundRequestCreate,
    updateMany: refundRequestUpdateMany,
  },
  orgMembership: { findMany: orgMembershipFindMany },
  $transaction: prismaTransaction,
};

const mockNotificationsService = { createForUser };

function eligibleBooking() {
  return {
    bookingCode: 'BK-REFUND-001',
    boothPrice: BOOTH_PRICE,
    isPaymentExempt: false,
    status: BookingStatus.CANCELLED,
    event: { organizationId: ORGANIZATION_ID },
    slips: [{ amount: new Prisma.Decimal('1500') }],
  };
}

function adminRefund(
  status: RefundStatus = RefundStatus.PENDING,
  approvedAmount: Prisma.Decimal | null = null,
) {
  return {
    status,
    requestedAmount: new Prisma.Decimal(CREATE_DTO.requestedAmount),
    approvedAmount,
    requestedByUserId: VENDOR_ID,
    booking: {
      boothPrice: BOOTH_PRICE,
      vendorUserId: VENDOR_ID,
    },
  };
}

describe('RefundsService', () => {
  let service: RefundsService;

  beforeEach(async () => {
    jest.useFakeTimers();
    jest.setSystemTime(NOW);
    jest.clearAllMocks();

    bookingFindFirst.mockResolvedValue(eligibleBooking());
    refundRequestFindFirst.mockResolvedValue(null);
    refundRequestFindMany.mockResolvedValue([REFUND]);
    refundRequestCreate.mockResolvedValue(REFUND);
    refundRequestUpdateMany.mockResolvedValue({ count: 1 });
    orgMembershipFindMany.mockResolvedValue([
      { userId: ADMIN_ID },
      { userId: OTHER_ADMIN_ID },
    ]);
    createForUser.mockResolvedValue(null);
    prismaTransaction.mockImplementation(
      (operation: (client: Prisma.TransactionClient) => Promise<unknown>) =>
        operation(mockPrismaService as unknown as Prisma.TransactionClient),
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RefundsService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: NotificationsService, useValue: mockNotificationsService },
      ],
    }).compile();
    service = module.get<RefundsService>(RefundsService);
  });

  afterEach(() => jest.useRealTimers());

  describe('create', () => {
    it('creates one request for an owned, cancelled and verified paid booking', async () => {
      await expect(
        service.create(BOOKING_ID, VENDOR_ID, CREATE_DTO),
      ).resolves.toEqual({
        ...REFUND,
        requestedAmount: '1200',
        approvedAmount: null,
      });

      expect(bookingFindFirst).toHaveBeenCalledWith({
        where: { id: BOOKING_ID, vendorUserId: VENDOR_ID },
        select: {
          bookingCode: true,
          boothPrice: true,
          isPaymentExempt: true,
          status: true,
          event: { select: { organizationId: true } },
          slips: {
            where: { slipokStatus: SlipStatus.VERIFIED },
            select: { amount: true },
          },
        },
      });
      expect(refundRequestCreate).toHaveBeenCalledWith({
        data: {
          bookingId: BOOKING_ID,
          requestedByUserId: VENDOR_ID,
          reason: CREATE_DTO.reason,
          requestedAmount: new Prisma.Decimal('1200'),
          status: RefundStatus.PENDING,
        },
        select: expect.any(Object) as object,
      });
      expect(prismaTransaction).toHaveBeenCalledWith(expect.any(Function), {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    });

    it('notifies only organization admins after the request commits', async () => {
      await service.create(BOOKING_ID, VENDOR_ID, CREATE_DTO);

      expect(orgMembershipFindMany).toHaveBeenCalledWith({
        where: {
          organizationId: ORGANIZATION_ID,
          user: { role: 'ORG_ADMIN' },
        },
        select: { userId: true },
      });
      expect(createForUser).toHaveBeenCalledTimes(2);
      expect(createForUser).toHaveBeenCalledWith(ADMIN_ID, {
        type: NotificationType.REFUND,
        title: 'มีคำร้องขอคืนเงินใหม่',
        body: 'การจอง BK-REFUND-001 ขอคืนเงิน 1200 บาท',
        relatedEntityType: 'REFUND_REQUEST',
        relatedEntityId: REFUND_ID,
      });
      expect(refundRequestCreate.mock.invocationCallOrder[0]).toBeLessThan(
        createForUser.mock.invocationCallOrder[0],
      );
    });

    it('keeps a committed request successful if admin notification lookup fails', async () => {
      const error = jest
        .spyOn(Logger.prototype, 'error')
        .mockImplementation(() => undefined);
      orgMembershipFindMany.mockRejectedValue(
        new Error('database unavailable'),
      );

      await expect(
        service.create(BOOKING_ID, VENDOR_ID, CREATE_DTO),
      ).resolves.toMatchObject({ id: REFUND_ID });
      expect(error).toHaveBeenCalledWith(
        'Failed to notify organization refund reviewers',
      );
      error.mockRestore();
    });

    it('returns the same 404 for an unknown or another vendor booking', async () => {
      bookingFindFirst.mockResolvedValue(null);
      await expect(
        service.create(BOOKING_ID, VENDOR_ID, CREATE_DTO),
      ).rejects.toEqual(new NotFoundException('ไม่พบการจอง'));
      expect(refundRequestCreate).not.toHaveBeenCalled();
    });

    it('requires cancellation before a refund request', async () => {
      bookingFindFirst.mockResolvedValue({
        ...eligibleBooking(),
        status: BookingStatus.CONFIRMED,
      });
      await expect(
        service.create(BOOKING_ID, VENDOR_ID, CREATE_DTO),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('rejects a payment-exempt booking and an unverified payment', async () => {
      bookingFindFirst.mockResolvedValue({
        ...eligibleBooking(),
        isPaymentExempt: true,
      });
      await expect(
        service.create(BOOKING_ID, VENDOR_ID, CREATE_DTO),
      ).rejects.toThrow('การจองนี้ไม่มีการชำระเงินให้คืน');

      bookingFindFirst.mockResolvedValue({ ...eligibleBooking(), slips: [] });
      await expect(
        service.create(BOOKING_ID, VENDOR_ID, CREATE_DTO),
      ).rejects.toThrow('ไม่พบการชำระเงินที่ตรวจสอบแล้วสำหรับการจองนี้');
    });

    it('rejects zero, over-price and duplicate requests', async () => {
      await expect(
        service.create(BOOKING_ID, VENDOR_ID, {
          ...CREATE_DTO,
          requestedAmount: '0',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      await expect(
        service.create(BOOKING_ID, VENDOR_ID, {
          ...CREATE_DTO,
          requestedAmount: '1500.01',
        }),
      ).rejects.toThrow('จำนวนเงินที่ขอคืนต้องไม่เกินราคาบูธ');

      refundRequestFindFirst.mockResolvedValue({ id: REFUND_ID });
      await expect(
        service.create(BOOKING_ID, VENDOR_ID, CREATE_DTO),
      ).rejects.toThrow('การจองนี้มีคำร้องคืนเงินแล้ว');
    });

    it('retries a serializable write conflict', async () => {
      prismaTransaction.mockRejectedValueOnce(
        new Prisma.PrismaClientKnownRequestError('write conflict', {
          code: 'P2034',
          clientVersion: 'test',
        }),
      );

      await expect(
        service.create(BOOKING_ID, VENDOR_ID, CREATE_DTO),
      ).resolves.toMatchObject({ id: REFUND_ID });
      expect(prismaTransaction).toHaveBeenCalledTimes(2);
    });
  });

  it('lists only caller-owned requests and stringifies money', async () => {
    await expect(service.findMine(VENDOR_ID)).resolves.toEqual([
      { ...REFUND, requestedAmount: '1200', approvedAmount: null },
    ]);
    expect(refundRequestFindMany).toHaveBeenCalledWith({
      where: { requestedByUserId: VENDOR_ID },
      select: expect.any(Object) as object,
      orderBy: { createdAt: 'desc' },
    });
  });

  it('filters the admin queue through the booking organization', async () => {
    await service.findForOrganization(ORGANIZATION_ID);
    expect(refundRequestFindMany).toHaveBeenCalledWith({
      where: { booking: { event: { organizationId: ORGANIZATION_ID } } },
      select: expect.any(Object) as object,
      orderBy: { createdAt: 'desc' },
    });
  });

  describe('admin transitions', () => {
    beforeEach(() => refundRequestFindFirst.mockResolvedValue(adminRefund()));

    it('approves PENDING with an amount bounded by request and booth price', async () => {
      refundRequestFindFirst
        .mockResolvedValueOnce(adminRefund())
        .mockResolvedValueOnce({
          ...REFUND,
          status: RefundStatus.APPROVED,
          approvedAmount: new Prisma.Decimal('1000'),
          reviewedByUserId: ADMIN_ID,
          reviewedAt: NOW,
        });

      await expect(
        service.approve(
          BOOKING_ID,
          REFUND_ID,
          ORGANIZATION_ID,
          ADMIN_ID,
          APPROVE_DTO,
        ),
      ).resolves.toMatchObject({
        status: RefundStatus.APPROVED,
        approvedAmount: '1000',
      });
      expect(refundRequestUpdateMany).toHaveBeenCalledWith({
        where: {
          id: REFUND_ID,
          bookingId: BOOKING_ID,
          status: RefundStatus.PENDING,
          booking: { event: { organizationId: ORGANIZATION_ID } },
        },
        data: {
          status: RefundStatus.APPROVED,
          approvedAmount: new Prisma.Decimal('1000'),
          reviewedByUserId: ADMIN_ID,
          reviewedAt: NOW,
        },
      });
      expect(createForUser).toHaveBeenCalledWith(
        VENDOR_ID,
        expect.objectContaining({
          type: NotificationType.REFUND,
          title: 'คำร้องคืนเงินได้รับการอนุมัติแล้ว',
          relatedEntityId: REFUND_ID,
        }) as object,
      );
    });

    it('rejects an approval above the requested amount', async () => {
      await expect(
        service.approve(BOOKING_ID, REFUND_ID, ORGANIZATION_ID, ADMIN_ID, {
          approvedAmount: '1200.01',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(refundRequestUpdateMany).not.toHaveBeenCalled();
    });

    it('returns 404 for a mismatched booking, tenant or refund id', async () => {
      refundRequestFindFirst.mockResolvedValue(null);
      await expect(
        service.reject(BOOKING_ID, REFUND_ID, ORGANIZATION_ID, ADMIN_ID),
      ).rejects.toEqual(new NotFoundException('ไม่พบคำร้องคืนเงิน'));
      expect(refundRequestFindFirst).toHaveBeenCalledWith({
        where: {
          id: REFUND_ID,
          bookingId: BOOKING_ID,
          booking: { event: { organizationId: ORGANIZATION_ID } },
        },
        select: expect.any(Object) as object,
      });
    });

    it('rejects only while PENDING and records the reviewer', async () => {
      refundRequestFindFirst
        .mockResolvedValueOnce(adminRefund())
        .mockResolvedValueOnce({
          ...REFUND,
          status: RefundStatus.REJECTED,
          reviewedByUserId: ADMIN_ID,
          reviewedAt: NOW,
        });

      await expect(
        service.reject(BOOKING_ID, REFUND_ID, ORGANIZATION_ID, ADMIN_ID),
      ).resolves.toMatchObject({ status: RefundStatus.REJECTED });
      expect(refundRequestUpdateMany).toHaveBeenCalledWith({
        where: {
          id: REFUND_ID,
          bookingId: BOOKING_ID,
          status: RefundStatus.PENDING,
          booking: { event: { organizationId: ORGANIZATION_ID } },
        },
        data: {
          status: RefundStatus.REJECTED,
          approvedAmount: null,
          reviewedByUserId: ADMIN_ID,
          reviewedAt: NOW,
        },
      });
    });

    it('processes only APPROVED and preserves its approved amount', async () => {
      refundRequestFindFirst
        .mockResolvedValueOnce(
          adminRefund(RefundStatus.APPROVED, new Prisma.Decimal('1000')),
        )
        .mockResolvedValueOnce({
          ...REFUND,
          status: RefundStatus.PROCESSED,
          approvedAmount: new Prisma.Decimal('1000'),
          reviewedByUserId: ADMIN_ID,
          reviewedAt: NOW,
          processedAt: NOW,
        });

      await expect(
        service.process(BOOKING_ID, REFUND_ID, ORGANIZATION_ID),
      ).resolves.toMatchObject({
        status: RefundStatus.PROCESSED,
        approvedAmount: '1000',
        processedAt: NOW,
      });
      expect(refundRequestUpdateMany).toHaveBeenCalledWith({
        where: {
          id: REFUND_ID,
          bookingId: BOOKING_ID,
          status: RefundStatus.APPROVED,
          booking: { event: { organizationId: ORGANIZATION_ID } },
        },
        data: { status: RefundStatus.PROCESSED, processedAt: NOW },
      });
    });

    it('prevents invalid or lost-race transitions', async () => {
      await expect(
        service.process(BOOKING_ID, REFUND_ID, ORGANIZATION_ID),
      ).rejects.toThrow('ต้องอนุมัติคำร้องก่อนยืนยันการคืนเงิน');

      refundRequestUpdateMany.mockResolvedValue({ count: 0 });
      await expect(
        service.reject(BOOKING_ID, REFUND_ID, ORGANIZATION_ID, ADMIN_ID),
      ).rejects.toThrow('สถานะคำร้องคืนเงินเปลี่ยนไปแล้ว');
      expect(createForUser).not.toHaveBeenCalled();
    });
  });
});
