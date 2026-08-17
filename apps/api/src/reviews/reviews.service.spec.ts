import { ConflictException, ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { BookingStatus, Prisma, ReviewTargetType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { ReviewsService } from './reviews.service';

const userId = '11111111-1111-4111-8111-111111111111';
const targetId = '22222222-2222-4222-8222-222222222222';
const reviewId = '33333333-3333-4333-8333-333333333333';
const dto: CreateReviewDto = {
  targetType: 'BOOTH',
  targetId,
  rating: 5,
  comment: 'พื้นที่สะอาดและเดินทางสะดวก',
};

const aggregate = jest.fn();
const bookingFindFirst = jest.fn();
const reviewFindFirst = jest.fn();
const reviewCreate = jest.fn();
const reviewUpdate = jest.fn();
const transactionClient = {
  booking: { findFirst: bookingFindFirst },
  review: {
    findFirst: reviewFindFirst,
    create: reviewCreate,
    update: reviewUpdate,
  },
};
const prismaTransaction = jest.fn();
const mockPrismaService = {
  review: { aggregate },
  $transaction: prismaTransaction,
};

function bookingEligibilityWhere(): {
  bookingEndDate: { lte: Date };
} {
  const [args] = bookingFindFirst.mock.calls[0] as [
    { where: { bookingEndDate: { lte: Date } } },
  ];
  return args.where;
}

describe('ReviewsService', () => {
  let service: ReviewsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date('2026-09-05T17:00:00.000Z'));
    aggregate.mockResolvedValue({
      _avg: { rating: null },
      _count: { rating: 0 },
    });
    bookingFindFirst.mockResolvedValue({ id: 'eligible-booking' });
    reviewFindFirst.mockResolvedValue(null);
    reviewCreate.mockResolvedValue({ id: reviewId });
    reviewUpdate.mockResolvedValue({ id: reviewId });
    prismaTransaction.mockImplementation(
      (operation: (client: Prisma.TransactionClient) => Promise<unknown>) =>
        operation(transactionClient as unknown as Prisma.TransactionClient),
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReviewsService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<ReviewsService>(ReviewsService);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('returns the live average and review count for any target type', async () => {
    aggregate.mockResolvedValue({
      _avg: { rating: 4.25 },
      _count: { rating: 8 },
    });

    await expect(
      service.getAverage(ReviewTargetType.SHOP, targetId),
    ).resolves.toEqual({ average: 4.25, count: 8 });
    expect(aggregate).toHaveBeenCalledWith({
      where: { targetType: ReviewTargetType.SHOP, targetId },
      _avg: { rating: true },
      _count: { rating: true },
    });
  });

  it('creates a booth review through a serializable transaction', async () => {
    await expect(service.create(userId, dto)).resolves.toEqual({
      id: reviewId,
    });

    expect(prismaTransaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
    expect(bookingFindFirst).toHaveBeenCalledWith({
      where: {
        vendorUserId: userId,
        status: {
          in: [BookingStatus.CONFIRMED, BookingStatus.COMPLETED],
        },
        bookingEndDate: { lte: new Date('2026-09-05T00:00:00.000Z') },
        boothId: targetId,
      },
      select: { id: true },
    });
    expect(reviewCreate).toHaveBeenCalledWith({
      data: {
        rating: dto.rating,
        comment: dto.comment,
        reviewerDisplayName: undefined,
        reviewerUserId: userId,
        targetType: dto.targetType,
        targetId,
      },
    });
  });

  it('derives zone eligibility through the booked booth', async () => {
    const zoneDto: CreateReviewDto = {
      targetType: 'ZONE',
      targetId,
      rating: 4,
    };

    await service.create(userId, zoneDto);

    expect(bookingFindFirst).toHaveBeenCalledWith({
      where: {
        vendorUserId: userId,
        status: {
          in: [BookingStatus.CONFIRMED, BookingStatus.COMPLETED],
        },
        bookingEndDate: { lte: new Date('2026-09-05T00:00:00.000Z') },
        booth: { zoneId: targetId },
      },
      select: { id: true },
    });
  });

  it('rejects a review one hour before the Bangkok-midnight cutoff', async () => {
    jest.setSystemTime(new Date('2026-09-05T16:00:00.000Z'));
    bookingFindFirst.mockResolvedValue(null);

    await expect(service.create(userId, dto)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(bookingEligibilityWhere().bookingEndDate.lte).toEqual(
      new Date('2026-09-04T23:00:00.000Z'),
    );
  });

  it('allows a review exactly at the Bangkok-midnight cutoff', async () => {
    await expect(service.create(userId, dto)).resolves.toEqual({
      id: reviewId,
    });
    expect(bookingEligibilityWhere().bookingEndDate.lte).toEqual(
      new Date('2026-09-05T00:00:00.000Z'),
    );
  });

  it('rejects a vendor without an eligible booking before reading reviews', async () => {
    bookingFindFirst.mockResolvedValue(null);

    await expect(service.create(userId, dto)).rejects.toThrow(
      'ต้องมีการจองที่จบงานแล้วกับพื้นที่นี้ก่อนถึงจะให้คะแนนได้',
    );
    expect(reviewFindFirst).not.toHaveBeenCalled();
    expect(reviewCreate).not.toHaveBeenCalled();
  });

  it('updates the existing review without auto-filling the display name', async () => {
    reviewFindFirst.mockResolvedValue({ id: reviewId });

    await service.create(userId, dto);

    expect(reviewUpdate).toHaveBeenCalledWith({
      where: { id: reviewId },
      data: {
        rating: dto.rating,
        comment: dto.comment,
        reviewerDisplayName: undefined,
      },
    });
    expect(reviewCreate).not.toHaveBeenCalled();
  });

  it('retries a serializable transaction conflict before saving', async () => {
    const serializationError = new Prisma.PrismaClientKnownRequestError(
      'Transaction write conflict',
      { code: 'P2034', clientVersion: 'test' },
    );
    prismaTransaction
      .mockRejectedValueOnce(serializationError)
      .mockImplementationOnce(
        (operation: (client: Prisma.TransactionClient) => Promise<unknown>) =>
          operation(transactionClient as unknown as Prisma.TransactionClient),
      );

    await expect(service.create(userId, dto)).resolves.toEqual({
      id: reviewId,
    });
    expect(prismaTransaction).toHaveBeenCalledTimes(2);
    expect(reviewCreate).toHaveBeenCalledTimes(1);
  });

  it('returns a clear conflict after three serialization failures', async () => {
    const serializationError = new Prisma.PrismaClientKnownRequestError(
      'Transaction write conflict',
      { code: 'P2034', clientVersion: 'test' },
    );
    prismaTransaction.mockRejectedValue(serializationError);

    await expect(service.create(userId, dto)).rejects.toEqual(
      new ConflictException('มีการให้คะแนนพร้อมกัน กรุณาลองใหม่อีกครั้ง'),
    );
    expect(prismaTransaction).toHaveBeenCalledTimes(3);
  });
});
