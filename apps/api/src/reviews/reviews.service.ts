import {
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { BookingStatus, Prisma, ReviewTargetType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateReviewDto } from './dto/create-review.dto';

const MS_PER_HOUR = 60 * 60 * 1000;
const REVIEW_ELIGIBLE_OFFSET_HOURS = 17;
const SERIALIZABLE_TRANSACTION_ATTEMPTS = 3;

export function reviewEligibleBookingWhere(
  now = new Date(),
): Prisma.BookingWhereInput {
  return {
    status: {
      in: [BookingStatus.CONFIRMED, BookingStatus.COMPLETED],
    },
    bookingEndDate: {
      lte: new Date(now.getTime() - REVIEW_ELIGIBLE_OFFSET_HOURS * MS_PER_HOUR),
    },
  };
}

@Injectable()
export class ReviewsService {
  constructor(private readonly prisma: PrismaService) {}

  async getAverage(targetType: ReviewTargetType, targetId: string) {
    const result = await this.prisma.review.aggregate({
      where: { targetType, targetId },
      _avg: { rating: true },
      _count: { rating: true },
    });

    return {
      average: result._avg.rating,
      count: result._count.rating,
    };
  }

  async getMine(userId: string, page: number, limit: number) {
    const where: Prisma.ReviewWhereInput = { reviewerUserId: userId };
    const [total, reviews] = await Promise.all([
      this.prisma.review.count({ where }),
      this.prisma.review.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          targetType: true,
          targetId: true,
          rating: true,
          comment: true,
          createdAt: true,
        },
      }),
    ]);

    const boothIds = reviews
      .filter((review) => review.targetType === ReviewTargetType.BOOTH)
      .map((review) => review.targetId);
    const zoneIds = reviews
      .filter((review) => review.targetType === ReviewTargetType.ZONE)
      .map((review) => review.targetId);
    const targetFilters: Prisma.BookingWhereInput[] = [];
    if (boothIds.length > 0) targetFilters.push({ boothId: { in: boothIds } });
    if (zoneIds.length > 0) {
      targetFilters.push({ booth: { zoneId: { in: zoneIds } } });
    }

    const bookings =
      targetFilters.length === 0
        ? []
        : await this.prisma.booking.findMany({
            where: {
              vendorUserId: userId,
              OR: targetFilters,
            },
            orderBy: [{ bookingEndDate: 'desc' }, { createdAt: 'desc' }],
            select: {
              bookingCode: true,
              boothId: true,
              event: { select: { name: true, slug: true } },
              booth: {
                select: {
                  code: true,
                  zone: { select: { id: true, code: true, name: true } },
                },
              },
            },
          });

    const contextByTarget = new Map<string, (typeof bookings)[number]>();
    for (const booking of bookings) {
      const boothKey = `${ReviewTargetType.BOOTH}:${booking.boothId}`;
      const zoneKey = `${ReviewTargetType.ZONE}:${booking.booth.zone.id}`;
      if (!contextByTarget.has(boothKey)) {
        contextByTarget.set(boothKey, booking);
      }
      if (!contextByTarget.has(zoneKey)) {
        contextByTarget.set(zoneKey, booking);
      }
    }

    return {
      items: reviews.map(({ targetId, ...review }) => {
        const context = contextByTarget.get(`${review.targetType}:${targetId}`);
        return {
          ...review,
          context: context
            ? {
                bookingCode: context.bookingCode,
                event: context.event,
                booth: { code: context.booth.code },
                zone: {
                  code: context.booth.zone.code,
                  name: context.booth.zone.name,
                },
              }
            : null,
        };
      }),
      page,
      limit,
      total,
      hasMore: page * limit < total,
    };
  }

  async create(userId: string, dto: CreateReviewDto) {
    for (
      let attempt = 1;
      attempt <= SERIALIZABLE_TRANSACTION_ATTEMPTS;
      attempt += 1
    ) {
      try {
        return await this.prisma.$transaction(
          (transaction) =>
            this.createWithinTransaction(transaction, userId, dto),
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2034'
        ) {
          if (attempt < SERIALIZABLE_TRANSACTION_ATTEMPTS) continue;
          throw new ConflictException(
            'มีการให้คะแนนพร้อมกัน กรุณาลองใหม่อีกครั้ง',
          );
        }
        throw error;
      }
    }

    throw new ConflictException('มีการให้คะแนนพร้อมกัน กรุณาลองใหม่อีกครั้ง');
  }

  private async createWithinTransaction(
    transaction: Prisma.TransactionClient,
    userId: string,
    dto: CreateReviewDto,
  ) {
    const eligible = await transaction.booking.findFirst({
      where: {
        ...reviewEligibleBookingWhere(),
        vendorUserId: userId,
        ...(dto.targetType === 'BOOTH'
          ? { boothId: dto.targetId }
          : { booth: { zoneId: dto.targetId } }),
      },
      select: { id: true },
    });

    if (!eligible) {
      throw new ForbiddenException(
        'ต้องมีการจองที่จบงานแล้วกับพื้นที่นี้ก่อนถึงจะให้คะแนนได้',
      );
    }

    const existing = await transaction.review.findFirst({
      where: {
        reviewerUserId: userId,
        targetType: dto.targetType,
        targetId: dto.targetId,
      },
      select: { id: true },
    });
    const data = {
      rating: dto.rating,
      comment: dto.comment,
      reviewerDisplayName: dto.reviewerDisplayName,
    };

    return existing
      ? transaction.review.update({ where: { id: existing.id }, data })
      : transaction.review.create({
          data: {
            ...data,
            reviewerUserId: userId,
            targetType: dto.targetType,
            targetId: dto.targetId,
          },
        });
  }
}
