import { ConflictException, ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import {
  BookingStatus,
  Prisma,
  ReviewStatus,
  ReviewTargetType,
} from '@prisma/client';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { isEventEnded, ReviewsService } from './reviews.service';

const userId = '11111111-1111-4111-8111-111111111111';
const bookingId = '22222222-2222-4222-8222-222222222222';
const targetId = '33333333-3333-4333-8333-333333333333';
const zoneId = '44444444-4444-4444-8444-444444444444';
const eventId = '55555555-5555-4555-8555-555555555555';
const organizationId = '66666666-6666-4666-8666-666666666666';
const reviewId = '77777777-7777-4777-8777-777777777777';

const dto: CreateReviewDto = {
  bookingId,
  targetType: 'BOOTH',
  targetId,
  rating: 5,
  comment: 'พื้นที่สะอาดและเดินทางสะดวก',
};

const aggregate = jest.fn();
const reviewCount = jest.fn();
const reviewFindMany = jest.fn();
const reviewFindUnique = jest.fn();
const reviewUpdateMany = jest.fn();
const bookingFindMany = jest.fn();
const eventFindMany = jest.fn();
const transactionBookingFindUnique = jest.fn();
const transactionReviewFindUnique = jest.fn();
const transactionReviewCreate = jest.fn();
const transactionReviewUpdate = jest.fn();
const transactionClient = {
  booking: { findUnique: transactionBookingFindUnique },
  review: {
    findUnique: transactionReviewFindUnique,
    create: transactionReviewCreate,
    update: transactionReviewUpdate,
  },
};
const prismaTransaction = jest.fn();
const recordAuditLog = jest.fn();
const mockPrismaService = {
  review: {
    aggregate,
    count: reviewCount,
    findMany: reviewFindMany,
    findUnique: reviewFindUnique,
    updateMany: reviewUpdateMany,
  },
  booking: { findMany: bookingFindMany },
  event: { findMany: eventFindMany },
  $transaction: prismaTransaction,
};

function eligibleBooking(status: BookingStatus = BookingStatus.CONFIRMED) {
  return {
    id: bookingId,
    vendorUserId: userId,
    boothId: targetId,
    status,
    eventId,
    event: {
      organizationId,
      endDate: new Date('2026-09-05T00:00:00.000Z'),
      endTime: '23:00',
    },
    booth: { zoneId },
  };
}

describe('isEventEnded', () => {
  const endDate = new Date('2026-09-05T00:00:00.000Z');

  it.each([null, 'invalid', '25:00'])(
    'falls back to 23:59 Bangkok when endTime is %p',
    (endTime) => {
      expect(
        isEventEnded(
          { endDate, endTime },
          new Date('2026-09-05T16:58:59.000Z'),
        ),
      ).toBe(false);
      expect(
        isEventEnded(
          { endDate, endTime },
          new Date('2026-09-05T16:59:00.000Z'),
        ),
      ).toBe(true);
    },
  );

  it('uses the exact event time across Bangkok midnight', () => {
    expect(
      isEventEnded(
        { endDate, endTime: '00:15' },
        new Date('2026-09-04T17:14:59.000Z'),
      ),
    ).toBe(false);
    expect(
      isEventEnded(
        { endDate, endTime: '00:15' },
        new Date('2026-09-04T17:15:00.000Z'),
      ),
    ).toBe(true);
  });
});

describe('ReviewsService', () => {
  let service: ReviewsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date('2026-09-05T16:00:00.000Z'));
    aggregate.mockResolvedValue({
      _avg: { rating: null },
      _count: { rating: 0 },
    });
    reviewCount.mockResolvedValue(0);
    reviewFindMany.mockResolvedValue([]);
    reviewFindUnique.mockResolvedValue({
      id: reviewId,
      status: ReviewStatus.PUBLISHED,
    });
    reviewUpdateMany.mockResolvedValue({ count: 1 });
    bookingFindMany.mockResolvedValue([]);
    eventFindMany.mockResolvedValue([]);
    transactionBookingFindUnique.mockResolvedValue(eligibleBooking());
    transactionReviewFindUnique.mockResolvedValue(null);
    transactionReviewCreate.mockResolvedValue({ id: reviewId });
    transactionReviewUpdate.mockResolvedValue({ id: reviewId });
    prismaTransaction.mockImplementation(
      (operation: (client: Prisma.TransactionClient) => Promise<unknown>) =>
        operation(transactionClient as unknown as Prisma.TransactionClient),
    );
    recordAuditLog.mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReviewsService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: AuditLogsService, useValue: { record: recordAuditLog } },
      ],
    }).compile();
    service = module.get(ReviewsService);
  });

  afterEach(() => jest.useRealTimers());

  it('counts only published reviews in a target average', async () => {
    aggregate.mockResolvedValue({
      _avg: { rating: 4.25 },
      _count: { rating: 8 },
    });

    await expect(
      service.getAverage(ReviewTargetType.SHOP, targetId),
    ).resolves.toEqual({ average: 4.25, count: 8 });
    expect(aggregate).toHaveBeenCalledWith({
      where: {
        targetType: ReviewTargetType.SHOP,
        targetId,
        status: ReviewStatus.PUBLISHED,
      },
      _avg: { rating: true },
      _count: { rating: true },
    });
  });

  it('returns only published event reviews with public pagination', async () => {
    aggregate.mockResolvedValue({
      _avg: { rating: 4.5 },
      _count: { rating: 2 },
    });
    reviewFindMany.mockResolvedValue([{ id: reviewId, rating: 5 }]);

    await expect(service.getForEvent(eventId, 1, 1)).resolves.toEqual({
      average: 4.5,
      count: 2,
      items: [{ id: reviewId, rating: 5 }],
      page: 1,
      limit: 1,
      hasMore: true,
    });
    expect(reviewFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { eventId, status: ReviewStatus.PUBLISHED },
        skip: 0,
        take: 1,
      }),
    );
  });

  it('returns the booking-linked context and moderation status in My Reviews', async () => {
    const createdAt = new Date('2026-09-05T10:00:00.000Z');
    reviewCount.mockResolvedValue(1);
    reviewFindMany.mockResolvedValue([
      {
        id: reviewId,
        targetType: ReviewTargetType.BOOTH,
        targetId,
        rating: 5,
        comment: 'ดีมาก',
        createdAt,
        status: ReviewStatus.HIDDEN,
        booking: {
          bookingCode: 'BK-001',
          event: { name: 'งานทดสอบ', slug: 'test-event' },
          booth: {
            code: 'A01',
            zone: { code: 'A', name: 'โซนอาหาร' },
          },
        },
      },
    ]);

    await expect(service.getMine(userId, 1, 10)).resolves.toEqual({
      items: [
        {
          id: reviewId,
          targetType: ReviewTargetType.BOOTH,
          rating: 5,
          comment: 'ดีมาก',
          createdAt,
          status: ReviewStatus.HIDDEN,
          context: {
            bookingCode: 'BK-001',
            event: { name: 'งานทดสอบ', slug: 'test-event' },
            booth: { code: 'A01' },
            zone: { code: 'A', name: 'โซนอาหาร' },
          },
        },
      ],
      page: 1,
      limit: 10,
      total: 1,
      hasMore: false,
    });
    expect(bookingFindMany).not.toHaveBeenCalled();
  });

  it('lists all moderation statuses for an organization without reviewer PII', async () => {
    reviewCount.mockResolvedValue(1);
    reviewFindMany.mockResolvedValue([
      { id: reviewId, status: ReviewStatus.DELETED },
    ]);
    eventFindMany.mockResolvedValue([{ id: eventId, name: 'งานทดสอบ' }]);

    await service.listForOrganization(organizationId, {
      eventId,
      rating: 2,
      page: 1,
      limit: 25,
    });

    const call = (
      reviewFindMany.mock.lastCall as unknown as [
        {
          where: Prisma.ReviewWhereInput;
          select: Record<string, unknown>;
        },
      ]
    )[0];
    expect(call.where).toEqual({ organizationId, eventId, rating: 2 });
    expect(call.select).not.toHaveProperty('reviewer');
    expect(call.select).not.toHaveProperty('reviewerUserId');
    expect(call.select).not.toHaveProperty('reviewerDisplayName');
  });

  it.each([BookingStatus.CONFIRMED, BookingStatus.COMPLETED])(
    'creates one booking-scoped review for %s',
    async (status) => {
      transactionBookingFindUnique.mockResolvedValue(eligibleBooking(status));

      await expect(service.create(userId, dto)).resolves.toEqual({
        id: reviewId,
      });
      expect(transactionReviewCreate).toHaveBeenCalledWith({
        data: {
          rating: dto.rating,
          comment: dto.comment,
          reviewerDisplayName: undefined,
          reviewerUserId: userId,
          targetType: dto.targetType,
          targetId,
          bookingId,
          eventId,
          organizationId,
          status: ReviewStatus.PUBLISHED,
        },
      });
    },
  );

  it('rejects an unknown or another user booking', async () => {
    transactionBookingFindUnique.mockResolvedValue({
      ...eligibleBooking(),
      vendorUserId: 'another-user',
    });
    await expect(service.create(userId, dto)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(transactionReviewFindUnique).not.toHaveBeenCalled();
  });

  it.each([
    ['BOOTH', zoneId],
    ['ZONE', targetId],
  ] as const)(
    'rejects a mismatched %s target',
    async (targetType, mismatchedId) => {
      await expect(
        service.create(userId, { ...dto, targetType, targetId: mismatchedId }),
      ).rejects.toThrow('พื้นที่รีวิวไม่ตรงกับการจอง');
    },
  );

  it('rejects a review before the exact event end time', async () => {
    transactionBookingFindUnique.mockResolvedValue({
      ...eligibleBooking(),
      event: { ...eligibleBooking().event, endTime: '23:01' },
    });
    await expect(service.create(userId, dto)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it.each([
    BookingStatus.PENDING_PAYMENT,
    BookingStatus.CANCELLED,
    BookingStatus.NO_SHOW,
  ])('rejects booking status %s', async (status) => {
    transactionBookingFindUnique.mockResolvedValue(eligibleBooking(status));
    await expect(service.create(userId, dto)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it.each([ReviewStatus.PUBLISHED, ReviewStatus.HIDDEN])(
    'updates content but preserves an existing %s status',
    async (status) => {
      transactionReviewFindUnique.mockResolvedValue({ id: reviewId, status });
      await service.create(userId, dto);
      expect(transactionReviewUpdate).toHaveBeenCalledWith({
        where: { id: reviewId },
        data: {
          rating: dto.rating,
          comment: dto.comment,
          reviewerDisplayName: undefined,
        },
      });
      expect(transactionReviewCreate).not.toHaveBeenCalled();
    },
  );

  it('rejects resubmission of a deleted review without writing', async () => {
    transactionReviewFindUnique.mockResolvedValue({
      id: reviewId,
      status: ReviewStatus.DELETED,
    });
    await expect(service.create(userId, dto)).rejects.toEqual(
      new ConflictException('รีวิวนี้ถูกลบแล้ว ไม่สามารถส่งใหม่ได้'),
    );
    expect(transactionReviewUpdate).not.toHaveBeenCalled();
    expect(transactionReviewCreate).not.toHaveBeenCalled();
  });

  it.each([
    ['hide', ReviewStatus.PUBLISHED, ReviewStatus.HIDDEN, 'review.hidden'],
    ['restore', ReviewStatus.HIDDEN, ReviewStatus.PUBLISHED, 'review.restored'],
    [
      'softDelete',
      ReviewStatus.PUBLISHED,
      ReviewStatus.DELETED,
      'review.deleted',
    ],
  ] as const)(
    '%s changes status and records the complete moderation audit',
    async (method, previousStatus, newStatus, action) => {
      reviewFindUnique
        .mockResolvedValueOnce({ id: reviewId, status: previousStatus })
        .mockResolvedValueOnce({ id: reviewId, status: newStatus });
      await service[method](reviewId, userId, 'เหตุผลทดสอบ');
      expect(reviewUpdateMany).toHaveBeenCalledWith({
        where: { id: reviewId, status: previousStatus },
        data: { status: newStatus },
      });
      expect(recordAuditLog).toHaveBeenCalledWith({
        actorUserId: userId,
        action,
        targetType: 'REVIEW',
        targetId: reviewId,
        metadata: {
          reason: 'เหตุผลทดสอบ',
          previousStatus,
          newStatus,
        },
      });
    },
  );

  it('enforces strict moderation transitions with a conflict', async () => {
    reviewFindUnique.mockResolvedValue({
      id: reviewId,
      status: ReviewStatus.HIDDEN,
    });
    await expect(service.hide(reviewId, userId, 'ซ้ำ')).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(reviewUpdateMany).not.toHaveBeenCalled();
    expect(recordAuditLog).not.toHaveBeenCalled();
  });

  it('retries a serializable transaction conflict', async () => {
    const error = new Prisma.PrismaClientKnownRequestError('conflict', {
      code: 'P2034',
      clientVersion: 'test',
    });
    prismaTransaction
      .mockRejectedValueOnce(error)
      .mockImplementationOnce(
        (operation: (client: Prisma.TransactionClient) => Promise<unknown>) =>
          operation(transactionClient as unknown as Prisma.TransactionClient),
      );
    await expect(service.create(userId, dto)).resolves.toEqual({
      id: reviewId,
    });
    expect(prismaTransaction).toHaveBeenCalledTimes(2);
  });
});
