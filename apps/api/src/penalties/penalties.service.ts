import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  NotificationType,
  PenaltyReason,
  Prisma,
  UserRole,
  type Penalty,
} from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAdminPenaltyDto } from './dto/create-admin-penalty.dto';
import { CreatePenaltyDto } from './dto/create-penalty.dto';

const penaltyOverviewSelect = {
  id: true,
  reason: true,
  description: true,
  points: true,
  issuedAt: true,
  user: {
    select: { id: true, email: true, fullName: true, trustScore: true },
  },
  organization: { select: { id: true, name: true } },
} satisfies Prisma.PenaltySelect;

const blacklistedUserSelect = {
  id: true,
  email: true,
  fullName: true,
  trustScore: true,
  blacklistReason: true,
} satisfies Prisma.UserSelect;

type PenaltyOverviewResponse = Prisma.PenaltyGetPayload<{
  select: typeof penaltyOverviewSelect;
}>;
type BlacklistedUserResponse = Prisma.UserGetPayload<{
  select: typeof blacklistedUserSelect;
}>;

export interface PenaltiesOverviewResponse {
  penalties: PenaltyOverviewResponse[];
  blacklistedUsers: BlacklistedUserResponse[];
}

const SERIALIZABLE_TRANSACTION_ATTEMPTS = 3;
const DEFAULT_PENALTY_POINTS: Record<PenaltyReason, number> = {
  [PenaltyReason.NO_SHOW]: 20,
  [PenaltyReason.RULE_VIOLATION]: 15,
  [PenaltyReason.CONTRACT_BREACH]: 30,
  [PenaltyReason.BAD_REVIEW]: 10,
  [PenaltyReason.OTHER]: 5,
};
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
    return this.createWithRetry((transaction) =>
      this.createForBookingWithinTransaction(
        transaction,
        bookingId,
        organizationId,
        createPenaltyDto,
      ),
    );
  }

  async createForUser(createPenaltyDto: CreateAdminPenaltyDto) {
    return this.createWithRetry((transaction) =>
      this.createForUserWithinTransaction(transaction, createPenaltyDto),
    );
  }

  private async createWithRetry(
    operation: (transaction: Prisma.TransactionClient) => Promise<{
      penalty: Penalty;
      justBlacklisted: boolean;
      trustScore: number;
    }>,
  ) {
    for (
      let attempt = 1;
      attempt <= SERIALIZABLE_TRANSACTION_ATTEMPTS;
      attempt += 1
    ) {
      try {
        const result = await this.prisma.$transaction(
          (transaction) => operation(transaction),
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );

        await this.notifyVendor(result.penalty, result.trustScore);
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

  private notifyVendor(penalty: Penalty, trustScore: number) {
    const reason = PENALTY_REASON_LABELS[penalty.reason];
    const issuedAt = THAILAND_DATE_TIME_FORMATTER.format(penalty.issuedAt);

    return this.notifications.createForUser(penalty.userId, {
      type: NotificationType.PENALTY,
      title: 'Trust Score ของคุณถูกหัก',
      body:
        `เหตุผล: ${reason} · หัก ${penalty.points} คะแนน · ` +
        `คงเหลือ ${trustScore}/100 · ${issuedAt}`,
      relatedEntityType: 'PENALTY',
      relatedEntityId: penalty.id,
    });
  }

  private async createForBookingWithinTransaction(
    transaction: Prisma.TransactionClient,
    bookingId: string,
    organizationId: string,
    createPenaltyDto: CreatePenaltyDto,
  ) {
    const booking = await transaction.booking.findFirst({
      where: { id: bookingId, event: { organizationId } },
      select: {
        vendorUserId: true,
        vendor: { select: { trustScore: true, isBlacklisted: true } },
      },
    });

    if (!booking) {
      throw new NotFoundException('ไม่พบการจอง');
    }

    return this.createPenaltyWithinTransaction(
      transaction,
      {
        organizationId,
        userId: booking.vendorUserId,
        bookingId,
        reason: createPenaltyDto.reason,
        points: createPenaltyDto.points,
        description: createPenaltyDto.description,
      },
      booking.vendor,
    );
  }

  private async createForUserWithinTransaction(
    transaction: Prisma.TransactionClient,
    createPenaltyDto: CreateAdminPenaltyDto,
  ) {
    const organization = await transaction.organization.findUnique({
      where: { id: createPenaltyDto.organizationId },
      select: { id: true },
    });
    if (!organization) {
      throw new NotFoundException('ไม่พบองค์กร');
    }

    const user = await transaction.user.findFirst({
      where: { id: createPenaltyDto.userId, role: UserRole.VENDOR },
      select: { trustScore: true, isBlacklisted: true },
    });
    if (!user) {
      throw new NotFoundException('ไม่พบผู้ขาย');
    }

    if (createPenaltyDto.bookingId) {
      const booking = await transaction.booking.findFirst({
        where: {
          id: createPenaltyDto.bookingId,
          vendorUserId: createPenaltyDto.userId,
          event: { organizationId: createPenaltyDto.organizationId },
        },
        select: { id: true },
      });
      if (!booking) {
        throw new NotFoundException('ไม่พบการจอง');
      }
    }

    return this.createPenaltyWithinTransaction(
      transaction,
      {
        organizationId: createPenaltyDto.organizationId,
        userId: createPenaltyDto.userId,
        bookingId: createPenaltyDto.bookingId,
        reason: createPenaltyDto.reason,
        points: createPenaltyDto.points,
        description: createPenaltyDto.description,
      },
      user,
    );
  }

  private async createPenaltyWithinTransaction(
    transaction: Prisma.TransactionClient,
    data: {
      organizationId: string;
      userId: string;
      bookingId?: string;
      reason: PenaltyReason;
      points?: number;
      description?: string;
    },
    user: { trustScore: number; isBlacklisted: boolean },
  ) {
    const points = data.points ?? DEFAULT_PENALTY_POINTS[data.reason];
    const penalty = await transaction.penalty.create({
      data: {
        organizationId: data.organizationId,
        userId: data.userId,
        bookingId: data.bookingId,
        reason: data.reason,
        points,
        description: data.description,
      },
    });
    const trustScore = Math.max(0, user.trustScore - points);
    const justBlacklisted = trustScore === 0 && !user.isBlacklisted;

    await transaction.user.update({
      where: { id: data.userId },
      data: {
        trustScore,
        ...(justBlacklisted
          ? {
              isBlacklisted: true,
              blacklistReason: 'คะแนนความน่าเชื่อถือลดลงเหลือ 0',
            }
          : {}),
      },
    });

    return { penalty, justBlacklisted, trustScore };
  }

  async listForBookingVendor(bookingId: string, organizationId: string) {
    const booking = await this.prisma.booking.findFirst({
      where: { id: bookingId, event: { organizationId } },
      select: {
        vendorUserId: true,
        vendor: { select: { trustScore: true, isBlacklisted: true } },
      },
    });

    if (!booking) {
      throw new NotFoundException('ไม่พบการจอง');
    }

    const penalties = await this.prisma.penalty.findMany({
      where: { organizationId, userId: booking.vendorUserId },
      orderBy: { issuedAt: 'desc' },
    });

    return {
      penalties,
      trustScore: booking.vendor.trustScore,
      isBlacklisted: booking.vendor.isBlacklisted,
    };
  }

  async findAllAcrossOrganizations(): Promise<PenaltiesOverviewResponse> {
    const [penalties, blacklistedUsers] = await Promise.all([
      this.prisma.penalty.findMany({
        select: penaltyOverviewSelect,
        orderBy: { issuedAt: 'desc' },
      }),
      this.prisma.user.findMany({
        where: { isBlacklisted: true },
        select: blacklistedUserSelect,
      }),
    ]);

    return { penalties, blacklistedUsers };
  }
}
