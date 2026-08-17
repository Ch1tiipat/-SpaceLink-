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
    const cutoff = new Date(
      Date.now() - REVIEW_ELIGIBLE_OFFSET_HOURS * MS_PER_HOUR,
    );
    const eligible = await transaction.booking.findFirst({
      where: {
        vendorUserId: userId,
        status: {
          in: [BookingStatus.CONFIRMED, BookingStatus.COMPLETED],
        },
        bookingEndDate: { lte: cutoff },
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
