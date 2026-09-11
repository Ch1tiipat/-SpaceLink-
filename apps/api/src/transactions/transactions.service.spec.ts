import { NotFoundException } from '@nestjs/common';
import {
  BookingStatus,
  PaymentGroupStatus,
  Prisma,
  RefundStatus,
  SlipStatus,
} from '@prisma/client';
import { Test, type TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { ListTransactionsQueryDto } from './dto/list-transactions-query.dto';
import { TransactionsService } from './transactions.service';

const ORGANIZATION_ID = '11111111-1111-4111-8111-111111111111';
const BOOKING_ID = '22222222-2222-4222-8222-222222222222';
const EVENT_ID = '33333333-3333-4333-8333-333333333333';
const ZONE_ID = '44444444-4444-4444-8444-444444444444';
const BOOTH_ID = '55555555-5555-4555-8555-555555555555';
const SHOP_ID = '66666666-6666-4666-8666-666666666666';
const VENDOR_ID = '77777777-7777-4777-8777-777777777777';
const CREATED = new Date('2026-09-01T03:00:00.000Z');

const bookingFindMany = jest.fn();
const bookingFindFirst = jest.fn();
const prisma = {
  booking: { findMany: bookingFindMany, findFirst: bookingFindFirst },
};

function booking(overrides: Record<string, unknown> = {}) {
  return {
    id: BOOKING_ID,
    bookingCode: 'BK-0001',
    paymentGroupId: null,
    eventId: EVENT_ID,
    boothId: BOOTH_ID,
    shopId: SHOP_ID,
    vendorUserId: VENDOR_ID,
    bookingStartDate: new Date('2026-10-01T00:00:00.000Z'),
    bookingEndDate: new Date('2026-10-02T00:00:00.000Z'),
    boothPrice: new Prisma.Decimal('1500.00'),
    isPaymentExempt: false,
    paymentExemptReason: null,
    status: BookingStatus.PENDING_PAYMENT,
    holdExpiresAt: new Date('2026-09-01T03:05:00.000Z'),
    confirmedAt: null,
    cancelledByUserId: null,
    cancelledByRole: null,
    cancelReason: null,
    cancelledAt: null,
    createdAt: CREATED,
    updatedAt: CREATED,
    event: {
      id: EVENT_ID,
      name: 'ตลาดสร้างสรรค์',
      organizationId: ORGANIZATION_ID,
    },
    booth: {
      id: BOOTH_ID,
      code: 'A01',
      zone: { id: ZONE_ID, code: 'A', name: 'อาหาร' },
    },
    shop: { id: SHOP_ID, name: 'ร้านทดสอบ' },
    vendor: {
      id: VENDOR_ID,
      fullName: 'ผู้ขายทดสอบ',
      email: 'vendor@example.com',
      phone: null,
    },
    slips: [],
    paymentGroup: null,
    refundRequests: [],
    ...overrides,
  };
}

function slip(status: SlipStatus, overrides: Record<string, unknown> = {}) {
  return {
    id: '88888888-8888-4888-8888-888888888888',
    slipokStatus: status,
    amount: new Prisma.Decimal('1500.00'),
    transRef: 'TRANS-1',
    sendingBank: 'KBANK',
    senderName: 'ผู้ขายทดสอบ',
    receiverName: 'องค์กรทดสอบ',
    slipImageUrl: 'https://storage.example.com/permanent/private-slip.jpg',
    slipokRaw: { provider: 'must-not-leak' },
    verifiedAt:
      status === SlipStatus.VERIFIED
        ? new Date('2026-09-01T03:02:00.000Z')
        : null,
    createdAt: new Date('2026-09-01T03:01:00.000Z'),
    ...overrides,
  };
}

function refund(overrides: Record<string, unknown> = {}) {
  return {
    id: '99999999-9999-4999-8999-999999999999',
    bookingId: BOOKING_ID,
    requestedByUserId: VENDOR_ID,
    reason: 'ยกเลิกการเข้าร่วม',
    requestedAmount: new Prisma.Decimal('500.00'),
    approvedAmount: null,
    status: RefundStatus.PENDING,
    evidenceUrls: ['https://example.com/evidence.jpg'],
    payoutMethod: 'PROMPTPAY',
    payoutPromptPayId: '0812345678',
    payoutBankName: null,
    payoutAccountNumber: null,
    payoutAccountName: 'ผู้ขายทดสอบ',
    reviewedByUserId: null,
    reviewedAt: null,
    processedAt: null,
    createdAt: new Date('2026-09-03T03:00:00.000Z'),
    updatedAt: new Date('2026-09-03T03:00:00.000Z'),
    requestedBy: {
      id: VENDOR_ID,
      fullName: 'ผู้ขายทดสอบ',
      email: 'vendor@example.com',
    },
    reviewedBy: null,
    ...overrides,
  };
}

function query(overrides: Partial<ListTransactionsQueryDto> = {}) {
  return Object.assign(new ListTransactionsQueryDto(), overrides);
}

describe('TransactionsService', () => {
  let service: TransactionsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransactionsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = module.get(TransactionsService);
  });

  it('returns booking-centric rows with real derived states and decimal strings', async () => {
    bookingFindMany.mockResolvedValue([
      booking({ slips: [slip(SlipStatus.ERROR)] }),
      booking({
        id: '22222222-2222-4222-8222-222222222223',
        bookingCode: 'BK-0002',
        isPaymentExempt: true,
        confirmedAt: new Date('2026-09-02T03:00:00.000Z'),
        status: BookingStatus.CONFIRMED,
      }),
    ]);

    const response = await service.findAll(ORGANIZATION_ID, query());

    expect(response.summary).toMatchObject({
      bookings: 2,
      payments: { FAILED: 1, EXEMPT: 1 },
      vendors: 1,
      shops: 1,
    });
    expect(response.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          bookingCode: 'BK-0001',
          paymentStatus: 'FAILED',
          boothPrice: '1500',
        }),
        expect.objectContaining({
          bookingCode: 'BK-0002',
          paymentStatus: 'EXEMPT',
        }),
      ]),
    );
    expect(bookingFindMany).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(bookingFindMany.mock.calls)).toContain(
      `"organizationId":"${ORGANIZATION_ID}"`,
    );
  });

  it('uses group slips, applies status filters and paginates after derivation', async () => {
    const groupSlip = slip(SlipStatus.VERIFIED);
    bookingFindMany.mockResolvedValue([
      booking({
        slips: [groupSlip],
        paymentGroupId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        paymentGroup: {
          id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          paymentCode: 'PG-0001',
          totalAmount: new Prisma.Decimal('3000.00'),
          status: PaymentGroupStatus.CONFIRMED,
          holdExpiresAt: new Date('2026-09-01T03:05:00.000Z'),
          confirmedAt: new Date('2026-09-01T03:02:00.000Z'),
          cancelledAt: null,
          createdAt: CREATED,
          updatedAt: CREATED,
          slips: [groupSlip],
        },
      }),
    ]);

    const response = await service.findAll(
      ORGANIZATION_ID,
      query({ view: 'PAYMENTS', paymentStatus: 'VERIFIED', pageSize: 1 }),
    );

    expect(response.total).toBe(1);
    expect(response.items[0]).toMatchObject({
      paymentStatus: 'VERIFIED',
      paymentGroup: { paymentCode: 'PG-0001', totalAmount: '3000' },
    });
  });

  it('flattens every refund request while keeping latest refund state on bookings', async () => {
    bookingFindMany.mockResolvedValue([
      booking({
        refundRequests: [
          refund({ status: RefundStatus.APPROVED }),
          refund({
            id: '99999999-9999-4999-8999-999999999998',
            status: RefundStatus.REJECTED,
            createdAt: new Date('2026-09-02T03:00:00.000Z'),
          }),
        ],
      }),
    ]);

    const response = await service.findAll(
      ORGANIZATION_ID,
      query({ view: 'REFUNDS', refundStatus: RefundStatus.REJECTED }),
    );

    expect(response.total).toBe(1);
    expect(response.summary.refunds.APPROVED).toBe(1);
    expect(response.items[0]).toMatchObject({
      status: RefundStatus.REJECTED,
      requestedAmount: '500',
      booking: { bookingCode: 'BK-0001' },
    });
  });

  it('aggregates vendors only from organization-filtered booking rows', async () => {
    bookingFindMany.mockResolvedValue([
      booking(),
      booking({
        id: '22222222-2222-4222-8222-222222222223',
        shop: {
          id: '66666666-6666-4666-8666-666666666667',
          name: 'ร้านที่สอง',
        },
        status: BookingStatus.CONFIRMED,
        createdAt: new Date('2026-09-02T03:00:00.000Z'),
      }),
    ]);

    const response = await service.findAll(
      ORGANIZATION_ID,
      query({ view: 'VENDORS' }),
    );

    expect(response.items).toHaveLength(1);
    const vendor = response.items[0] as {
      id: string;
      bookingCount: number;
      confirmedCount: number;
      shops: { id: string; name: string }[];
    };
    expect(vendor.id).toBe(VENDOR_ID);
    expect(vendor.bookingCount).toBe(2);
    expect(vendor.confirmedCount).toBe(1);
    expect(vendor.shops).toEqual(
      expect.arrayContaining([
        { id: SHOP_ID, name: 'ร้านทดสอบ' },
        {
          id: '66666666-6666-4666-8666-666666666667',
          name: 'ร้านที่สอง',
        },
      ]),
    );
  });

  it('returns a joined detail without raw verifier data or permanent image URL', async () => {
    bookingFindFirst.mockResolvedValue(
      booking({
        status: BookingStatus.CONFIRMED,
        confirmedAt: new Date('2026-09-01T03:02:00.000Z'),
        slips: [slip(SlipStatus.VERIFIED)],
        refundRequests: [refund()],
      }),
    );

    const response = await service.findBookingDetail(
      ORGANIZATION_ID,
      BOOKING_ID,
    );

    expect(bookingFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: BOOKING_ID, event: { organizationId: ORGANIZATION_ID } },
      }),
    );
    expect(response.payment.status).toBe('VERIFIED');
    expect(response.payment.slips[0]).toHaveProperty(
      'status',
      SlipStatus.VERIFIED,
    );
    expect(response.payment.slips[0]).not.toHaveProperty('slipokRaw');
    expect(response.payment.slips[0]).not.toHaveProperty('slipImageUrl');
    expect(response.timeline.map((item) => item.type)).toEqual(
      expect.arrayContaining([
        'BOOKING_CREATED',
        'SLIP_VERIFIED',
        'BOOKING_CONFIRMED',
        'REFUND_REQUESTED',
      ]),
    );
  });

  it('answers 404 identically for missing and cross-organization bookings', async () => {
    bookingFindFirst.mockResolvedValue(null);

    await expect(
      service.findBookingDetail(ORGANIZATION_ID, BOOKING_ID),
    ).rejects.toEqual(new NotFoundException('ไม่พบการจอง'));
  });

  it.each([{ from: '2026-02-30' }, { from: '2026-09-03', to: '2026-09-02' }])(
    'rejects an impossible date range %#',
    async (filters) => {
      bookingFindMany.mockResolvedValue([]);

      await expect(
        service.findAll(ORGANIZATION_ID, query(filters)),
      ).rejects.toThrow('วันที่');
    },
  );
});
