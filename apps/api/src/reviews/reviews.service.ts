import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  BookingStatus,
  Prisma,
  ReviewStatus,
  ReviewTargetType,
} from '@prisma/client';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { PrismaService } from '../prisma/prisma.service';
import { AdminReviewsQueryDto } from './dto/admin-reviews-query.dto';
import { CreateReviewDto } from './dto/create-review.dto';

const SERIALIZABLE_TRANSACTION_ATTEMPTS = 3;
const REVIEWABLE_BOOKING_STATUSES: BookingStatus[] = [
  BookingStatus.CONFIRMED,
  BookingStatus.COMPLETED,
];

export function isEventEnded(
  event: { endDate: Date; endTime: string | null },
  now = new Date(),
): boolean {
  const dateKey = event.endDate.toISOString().slice(0, 10);
  const timePart =
    event.endTime && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(event.endTime)
      ? event.endTime
      : '23:59';
  const endInstant = new Date(`${dateKey}T${timePart}:00+07:00`);
  return endInstant.getTime() <= now.getTime();
}

@Injectable()
export class ReviewsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogs: AuditLogsService,
  ) {}

  async getAverage(targetType: ReviewTargetType, targetId: string) {
    const result = await this.prisma.review.aggregate({
      where: { targetType, targetId, status: ReviewStatus.PUBLISHED },
      _avg: { rating: true },
      _count: { rating: true },
    });

    return {
      average: result._avg.rating,
      count: result._count.rating,
    };
  }

  async getForEvent(eventId: string, page: number, limit: number) {
    const where: Prisma.ReviewWhereInput = {
      eventId,
      status: ReviewStatus.PUBLISHED,
    };
    const [summary, items] = await Promise.all([
      this.prisma.review.aggregate({
        where,
        _avg: { rating: true },
        _count: { rating: true },
      }),
      this.prisma.review.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          targetType: true,
          rating: true,
          comment: true,
          createdAt: true,
          booking: {
            select: {
              booth: {
                select: {
                  code: true,
                  zone: { select: { code: true, name: true } },
                },
              },
            },
          },
        },
      }),
    ]);
    const count = summary._count.rating;

    return {
      average: summary._avg.rating,
      count,
      items,
      page,
      limit,
      hasMore: page * limit < count,
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
          status: true,
          booking: {
            select: {
              bookingCode: true,
              event: { select: { name: true, slug: true } },
              booth: {
                select: {
                  code: true,
                  zone: { select: { code: true, name: true } },
                },
              },
            },
          },
        },
      }),
    ]);

    const legacyReviews = reviews.filter((review) => !review.booking);
    const boothIds = legacyReviews
      .filter((review) => review.targetType === ReviewTargetType.BOOTH)
      .map((review) => review.targetId);
    const zoneIds = legacyReviews
      .filter((review) => review.targetType === ReviewTargetType.ZONE)
      .map((review) => review.targetId);
    const targetFilters: Prisma.BookingWhereInput[] = [];
    if (boothIds.length > 0) targetFilters.push({ boothId: { in: boothIds } });
    if (zoneIds.length > 0) {
      targetFilters.push({ booth: { zoneId: { in: zoneIds } } });
    }

    const legacyBookings =
      targetFilters.length === 0
        ? []
        : await this.prisma.booking.findMany({
            where: { vendorUserId: userId, OR: targetFilters },
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

    const legacyContextByTarget = new Map<
      string,
      (typeof legacyBookings)[number]
    >();
    for (const booking of legacyBookings) {
      const boothKey = `${ReviewTargetType.BOOTH}:${booking.boothId}`;
      const zoneKey = `${ReviewTargetType.ZONE}:${booking.booth.zone.id}`;
      if (!legacyContextByTarget.has(boothKey)) {
        legacyContextByTarget.set(boothKey, booking);
      }
      if (!legacyContextByTarget.has(zoneKey)) {
        legacyContextByTarget.set(zoneKey, booking);
      }
    }

    return {
      items: reviews.map(({ targetId, booking, ...review }) => {
        const context =
          booking ??
          legacyContextByTarget.get(`${review.targetType}:${targetId}`);
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

  async listForOrganization(
    organizationId: string,
    query: AdminReviewsQueryDto,
  ) {
    const where: Prisma.ReviewWhereInput = {
      organizationId,
      ...(query.eventId ? { eventId: query.eventId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.rating ? { rating: query.rating } : {}),
    };
    const [total, items, events] = await Promise.all([
      this.prisma.review.count({ where }),
      this.prisma.review.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        select: {
          id: true,
          targetType: true,
          rating: true,
          comment: true,
          status: true,
          createdAt: true,
          event: { select: { id: true, name: true } },
          booking: {
            select: {
              bookingCode: true,
              booth: {
                select: {
                  code: true,
                  zone: { select: { code: true, name: true } },
                },
              },
            },
          },
        },
      }),
      this.prisma.event.findMany({
        where: { organizationId },
        orderBy: [{ startDate: 'desc' }, { name: 'asc' }],
        select: { id: true, name: true },
      }),
    ]);

    return {
      items,
      page: query.page,
      limit: query.limit,
      total,
      hasMore: query.page * query.limit < total,
      filters: { events },
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

  async hide(reviewId: string, actorUserId: string, reason: string) {
    return this.moderate(
      reviewId,
      actorUserId,
      reason,
      ReviewStatus.HIDDEN,
      'review.hidden',
      [ReviewStatus.PUBLISHED],
    );
  }

  async restore(reviewId: string, actorUserId: string, reason: string) {
    return this.moderate(
      reviewId,
      actorUserId,
      reason,
      ReviewStatus.PUBLISHED,
      'review.restored',
      [ReviewStatus.HIDDEN],
    );
  }

  async softDelete(reviewId: string, actorUserId: string, reason: string) {
    return this.moderate(
      reviewId,
      actorUserId,
      reason,
      ReviewStatus.DELETED,
      'review.deleted',
      [ReviewStatus.PUBLISHED, ReviewStatus.HIDDEN],
    );
  }

  private async createWithinTransaction(
    transaction: Prisma.TransactionClient,
    userId: string,
    dto: CreateReviewDto,
  ) {
    const booking = await transaction.booking.findUnique({
      where: { id: dto.bookingId },
      select: {
        id: true,
        vendorUserId: true,
        boothId: true,
        status: true,
        eventId: true,
        event: {
          select: {
            organizationId: true,
            endDate: true,
            endTime: true,
          },
        },
        booth: { select: { zoneId: true } },
      },
    });

    if (!booking || booking.vendorUserId !== userId) {
      throw new ForbiddenException('การจองนี้ไม่อนุญาตให้บัญชีนี้รีวิว');
    }

    const targetMatches =
      dto.targetType === 'BOOTH'
        ? booking.boothId === dto.targetId
        : booking.booth.zoneId === dto.targetId;
    if (!targetMatches) {
      throw new ForbiddenException('พื้นที่รีวิวไม่ตรงกับการจอง');
    }

    if (
      !REVIEWABLE_BOOKING_STATUSES.includes(booking.status) ||
      !isEventEnded(booking.event)
    ) {
      throw new ForbiddenException(
        'สามารถให้คะแนนได้หลังงานสิ้นสุดและการจองได้รับการยืนยันแล้วเท่านั้น',
      );
    }

    const existing = await transaction.review.findUnique({
      where: { bookingId: booking.id },
      select: { id: true, status: true },
    });
    if (existing?.status === ReviewStatus.DELETED) {
      throw new ConflictException('รีวิวนี้ถูกลบแล้ว ไม่สามารถส่งใหม่ได้');
    }

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
            bookingId: booking.id,
            eventId: booking.eventId,
            organizationId: booking.event.organizationId,
            status: ReviewStatus.PUBLISHED,
          },
        });
  }

  private async moderate(
    reviewId: string,
    actorUserId: string,
    reason: string,
    newStatus: ReviewStatus,
    action: string,
    allowedStatuses: ReviewStatus[],
  ) {
    const review = await this.prisma.review.findUnique({
      where: { id: reviewId },
      select: { id: true, status: true },
    });
    if (!review) throw new NotFoundException('ไม่พบรีวิว');
    if (!allowedStatuses.includes(review.status)) {
      throw new ConflictException('สถานะรีวิวไม่อนุญาตให้ดำเนินการนี้');
    }

    const changed = await this.prisma.review.updateMany({
      where: { id: reviewId, status: review.status },
      data: { status: newStatus },
    });
    if (changed.count !== 1) {
      throw new ConflictException('สถานะรีวิวมีการเปลี่ยนแปลง กรุณาลองใหม่');
    }

    await this.auditLogs.record({
      actorUserId,
      action,
      targetType: 'REVIEW',
      targetId: reviewId,
      metadata: {
        reason,
        previousStatus: review.status,
        newStatus,
      },
    });
    return this.prisma.review.findUnique({
      where: { id: reviewId },
      select: {
        id: true,
        targetType: true,
        rating: true,
        comment: true,
        status: true,
        createdAt: true,
      },
    });
  }
}
