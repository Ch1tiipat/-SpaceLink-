import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  NotificationType,
  PenaltyReason,
  Prisma,
  type Penalty,
} from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePenaltyDto } from './dto/create-penalty.dto';

const BLACKLIST_THRESHOLD_POINTS = 3;
const SERIALIZABLE_TRANSACTION_ATTEMPTS = 3;
const PENALTY_REASON_LABELS: Record<PenaltyReason, string> = {
  [PenaltyReason.NO_SHOW]: 'ไม่มาตามนัด',
  [PenaltyReason.RULE_VIOLATION]: 'ทำผิดกติกาการใช้พื้นที่',
  [PenaltyReason.CONTRACT_BREACH]: 'ผิดสัญญา',
  [PenaltyReason.BAD_REVIEW]: 'ได้รับรีวิวไม่ดี',
  [PenaltyReason.OTHER]: 'อื่นๆ',
};
const THAILAND_DATE_TIME_FORMATTER = new Intl.DateTimeFormat('th-TH', {
  timeZone: 'Asia/Bangkok',
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

@Injectable()
export class PenaltiesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async create(
    bookingId: string,
    organizationId: string,
    createPenaltyDto: CreatePenaltyDto,
  ) {
    for (
      let attempt = 1;
      attempt <= SERIALIZABLE_TRANSACTION_ATTEMPTS;
      attempt += 1
    ) {
      try {
        const result = await this.prisma.$transaction(
          (transaction) =>
            this.createWithinTransaction(
              transaction,
              bookingId,
              organizationId,
              createPenaltyDto,
            ),
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );

        await this.notifyVendor(result.penalty);
        return result;
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2034'
        ) {
          if (attempt < SERIALIZABLE_TRANSACTION_ATTEMPTS) continue;
          throw new ConflictException(
            'มีการออกแต้มโทษพร้อมกัน กรุณาลองใหม่อีกครั้ง',
          );
        }
        throw error;
      }
    }

    throw new ConflictException('มีการออกแต้มโทษพร้อมกัน กรุณาลองใหม่อีกครั้ง');
  }

  private notifyVendor(penalty: Penalty) {
    const reason = PENALTY_REASON_LABELS[penalty.reason];
    const issuedAt = THAILAND_DATE_TIME_FORMATTER.format(penalty.issuedAt);

    return this.notifications.createForUser(penalty.userId, {
      type: NotificationType.PENALTY,
      title: 'คุณได้รับแต้มโทษ',
      body: `เหตุผล: ${reason} · ${penalty.points} แต้ม · ${issuedAt}`,
      relatedEntityType: 'PENALTY',
      relatedEntityId: penalty.id,
    });
  }

  private async createWithinTransaction(
    transaction: Prisma.TransactionClient,
    bookingId: string,
    organizationId: string,
    createPenaltyDto: CreatePenaltyDto,
  ) {
    const booking = await transaction.booking.findFirst({
      where: { id: bookingId, event: { organizationId } },
      select: {
        vendorUserId: true,
        vendor: { select: { isBlacklisted: true } },
      },
    });

    if (!booking) {
      throw new NotFoundException('ไม่พบการจอง');
    }

    const penalty = await transaction.penalty.create({
      data: {
        organizationId,
        userId: booking.vendorUserId,
        bookingId,
        reason: createPenaltyDto.reason,
        description: createPenaltyDto.description,
      },
    });
    const totals = await transaction.penalty.aggregate({
      where: { userId: booking.vendorUserId },
      _sum: { points: true },
    });
    const totalPoints = totals._sum.points ?? 0;
    const justBlacklisted =
      totalPoints >= BLACKLIST_THRESHOLD_POINTS &&
      !booking.vendor.isBlacklisted;

    if (justBlacklisted) {
      await transaction.user.update({
        where: { id: booking.vendorUserId },
        data: {
          isBlacklisted: true,
          blacklistReason:
            `สะสมแต้มโทษครบ ${totalPoints} แต้ม ` +
            `(เกณฑ์ ${BLACKLIST_THRESHOLD_POINTS} แต้ม)`,
        },
      });
    }

    return { penalty, justBlacklisted, totalPoints };
  }

  async listForBookingVendor(bookingId: string, organizationId: string) {
    const booking = await this.prisma.booking.findFirst({
      where: { id: bookingId, event: { organizationId } },
      select: { vendorUserId: true },
    });

    if (!booking) {
      throw new NotFoundException('ไม่พบการจอง');
    }

    const [penalties, totals] = await Promise.all([
      this.prisma.penalty.findMany({
        where: { organizationId, userId: booking.vendorUserId },
        orderBy: { issuedAt: 'desc' },
      }),
      this.prisma.penalty.aggregate({
        where: { userId: booking.vendorUserId },
        _sum: { points: true },
      }),
    ]);

    return {
      penalties,
      totalPointsAllOrgs: totals._sum.points ?? 0,
    };
  }
}
