import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  BookingStatus,
  MembershipRole,
  NotificationType,
  Prisma,
  ReviewTargetType,
  UserRole,
  type Notification,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { reviewEligibleBookingWhere } from '../reviews/reviews.service';
import { PushSenderService } from './push-sender.service';

export interface CreateNotificationInput {
  type: NotificationType;
  title: string;
  body?: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
}

export type OrganizationNotificationPermission = 'payments' | 'zones';

const bangkokDateFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Bangkok',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});
const REVIEW_NOTIFICATION_ENTITY_TYPE = 'BOOKING_REVIEW';
const SERIALIZABLE_TRANSACTION_ATTEMPTS = 3;

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly pushSender: PushSenderService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE, { waitForCompletion: true })
  async createReviewEligibilityNotifications(): Promise<number> {
    try {
      for (
        let attempt = 1;
        attempt <= SERIALIZABLE_TRANSACTION_ATTEMPTS;
        attempt += 1
      ) {
        try {
          return await this.prisma.$transaction(
            (transaction) =>
              this.createReviewEligibilityNotificationsWithinTransaction(
                transaction,
              ),
            { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
          );
        } catch (error) {
          if (
            error instanceof Prisma.PrismaClientKnownRequestError &&
            error.code === 'P2034' &&
            attempt < SERIALIZABLE_TRANSACTION_ATTEMPTS
          ) {
            continue;
          }
          throw error;
        }
      }
    } catch {
      // This scheduled reconciliation is intentionally best-effort. Booking
      // and review writes happen independently and must never be rolled back
      // because an invitation could not be created.
      this.logger.error('Failed to create review eligibility notifications');
    }

    return 0;
  }

  async createForUser(
    userId: string,
    input: CreateNotificationInput,
  ): Promise<Notification | null> {
    try {
      const notification = await this.prisma.notification.create({
        data: { userId, ...input },
      });
      void this.pushSender
        .sendToUser(userId, {
          title: input.title,
          body: input.body ?? '',
        })
        .catch(() => undefined);
      return notification;
    } catch {
      // Notification delivery is best-effort. Never include the title or body
      // here: they can contain user-visible details that do not belong in logs.
      this.logger.error('Failed to create an in-app notification');
      return null;
    }
  }

  /**
   * Creates one notification for every current user with the requested
   * platform role. Role-based fan-out is used for platform queues that every
   * SUPER_ADMIN may act on, independently of organization membership.
   */
  async createForRole(
    role: UserRole,
    input: CreateNotificationInput,
  ): Promise<number> {
    try {
      const recipients = await this.prisma.user.findMany({
        where: { role },
        select: { id: true },
      });

      if (recipients.length === 0) return 0;

      const userIds = recipients.map(({ id }) => id);
      const created = await this.prisma.notification.createMany({
        data: userIds.map((userId) => ({ userId, ...input })),
      });

      void this.pushSender
        .sendToUsers(userIds, { title: input.title, body: input.body ?? '' })
        .catch(() => undefined);

      return created.count;
    } catch {
      this.logger.error('Failed to create role-based notifications');
      return 0;
    }
  }

  /**
   * Sends an organization-scoped notification to delegated ADMIN members.
   * When nobody has the requested permission, the organization's OWNER is
   * used as the fallback. Legacy organizations without an OWNER temporarily
   * notify every ADMIN until ownership and delegated permissions are assigned.
   */
  async createForOrganizationAdmins(
    organizationId: string,
    permission: OrganizationNotificationPermission,
    input: CreateNotificationInput,
  ): Promise<number> {
    try {
      const permissionFilter =
        permission === 'payments'
          ? { canManagePayments: true }
          : { canManageZones: true };
      let recipients = await this.prisma.orgMembership.findMany({
        where: {
          organizationId,
          role: MembershipRole.ADMIN,
          ...permissionFilter,
          user: { role: UserRole.ORG_ADMIN },
        },
        select: { userId: true },
      });

      if (recipients.length === 0) {
        recipients = await this.prisma.orgMembership.findMany({
          where: {
            organizationId,
            role: MembershipRole.OWNER,
            user: { role: UserRole.ORG_ADMIN },
          },
          select: { userId: true },
        });
      }

      if (recipients.length === 0) {
        recipients = await this.prisma.orgMembership.findMany({
          where: {
            organizationId,
            role: MembershipRole.ADMIN,
            user: { role: UserRole.ORG_ADMIN },
          },
          select: { userId: true },
        });
      }

      if (recipients.length === 0) return 0;

      const userIds = recipients.map(({ userId }) => userId);
      const created = await this.prisma.notification.createMany({
        data: userIds.map((userId) => ({ userId, ...input })),
      });

      void this.pushSender
        .sendToUsers(userIds, { title: input.title, body: input.body ?? '' })
        .catch(() => undefined);

      return created.count;
    } catch {
      this.logger.error('Failed to create organization admin notifications');
      return 0;
    }
  }

  /**
   * Runs only after the announcement write has committed. A fan-out failure
   * must never make an already-saved announcement appear to have failed.
   */
  async fanOutToOrganizationBookers(
    organizationId: string,
    input: CreateNotificationInput,
  ): Promise<number> {
    try {
      const recipients = await this.prisma.booking.findMany({
        where: {
          status: { not: BookingStatus.CANCELLED },
          event: {
            organizationId,
            endDate: { gte: this.bangkokCalendarDate() },
          },
        },
        select: { vendorUserId: true },
        distinct: ['vendorUserId'],
      });

      if (recipients.length === 0) return 0;

      const created = await this.prisma.notification.createMany({
        data: recipients.map(({ vendorUserId }) => ({
          userId: vendorUserId,
          ...input,
        })),
      });

      return created.count;
    } catch {
      this.logger.error('Failed to fan out an announcement notification');
      return 0;
    }
  }

  /**
   * Persists one in-app notification per current user with a single bulk
   * write. Web push starts only after that write succeeds and remains
   * best-effort so it cannot change the result of the broadcast request.
   */
  async broadcastToAllUsers(input: {
    title: string;
    body: string;
  }): Promise<number> {
    try {
      const users = await this.prisma.user.findMany({ select: { id: true } });

      if (users.length === 0) return 0;

      const userIds = users.map(({ id }) => id);
      await this.prisma.notification.createMany({
        data: userIds.map((userId) => ({
          userId,
          type: NotificationType.SYSTEM,
          title: input.title,
          body: input.body,
        })),
      });

      void this.pushSender.sendToUsers(userIds, input).catch(() => undefined);

      return users.length;
    } catch {
      this.logger.error('Failed to fan out a system broadcast notification');
      return 0;
    }
  }

  findMine(userId: string, unreadOnly = false) {
    return this.prisma.notification.findMany({
      where: { userId, ...(unreadOnly ? { isRead: false } : {}) },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async unreadCount(userId: string): Promise<{ count: number }> {
    const count = await this.prisma.notification.count({
      where: { userId, isRead: false },
    });
    return { count };
  }

  async markRead(
    userId: string,
    notificationId: string,
  ): Promise<{ count: number }> {
    const updated = await this.prisma.notification.updateMany({
      where: { id: notificationId, userId },
      data: { isRead: true },
    });

    if (updated.count === 0) {
      throw new NotFoundException('ไม่พบการแจ้งเตือน');
    }

    return updated;
  }

  markAllRead(userId: string): Promise<{ count: number }> {
    return this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
  }

  private async createReviewEligibilityNotificationsWithinTransaction(
    transaction: Prisma.TransactionClient,
  ): Promise<number> {
    const eligibleBookings = await transaction.booking.findMany({
      where: reviewEligibleBookingWhere(),
      select: {
        id: true,
        vendorUserId: true,
        boothId: true,
        event: { select: { name: true } },
        booth: { select: { code: true } },
      },
      orderBy: [{ bookingEndDate: 'desc' }, { createdAt: 'desc' }],
    });

    if (eligibleBookings.length === 0) return 0;

    const userIds = [
      ...new Set(eligibleBookings.map(({ vendorUserId }) => vendorUserId)),
    ];
    const boothIds = [
      ...new Set(eligibleBookings.map(({ boothId }) => boothId)),
    ];
    const bookingIds = eligibleBookings.map(({ id }) => id);

    const [reviews, existingNotifications] = await Promise.all([
      transaction.review.findMany({
        where: {
          reviewerUserId: { in: userIds },
          targetType: ReviewTargetType.BOOTH,
          targetId: { in: boothIds },
        },
        select: { reviewerUserId: true, targetId: true },
      }),
      transaction.notification.findMany({
        where: {
          userId: { in: userIds },
          relatedEntityType: REVIEW_NOTIFICATION_ENTITY_TYPE,
          relatedEntityId: { in: bookingIds },
        },
        select: { userId: true, relatedEntityId: true },
      }),
    ]);

    const eligibilityKey = (userId: string, boothId: string) =>
      `${userId}:${boothId}`;
    const reviewedKeys = new Set(
      reviews.flatMap(({ reviewerUserId, targetId }) =>
        reviewerUserId ? [eligibilityKey(reviewerUserId, targetId)] : [],
      ),
    );
    const bookingById = new Map(
      eligibleBookings.map((booking) => [booking.id, booking]),
    );
    const invitedKeys = new Set(
      existingNotifications.flatMap(({ userId, relatedEntityId }) => {
        const booking = relatedEntityId
          ? bookingById.get(relatedEntityId)
          : undefined;
        return booking && booking.vendorUserId === userId
          ? [eligibilityKey(userId, booking.boothId)]
          : [];
      }),
    );
    const selectedKeys = new Set<string>();
    const invitations = eligibleBookings.flatMap((booking) => {
      const key = eligibilityKey(booking.vendorUserId, booking.boothId);
      if (
        reviewedKeys.has(key) ||
        invitedKeys.has(key) ||
        selectedKeys.has(key)
      ) {
        return [];
      }

      selectedKeys.add(key);
      return [
        {
          userId: booking.vendorUserId,
          type: NotificationType.SYSTEM,
          title: 'ถึงเวลารีวิวพื้นที่แล้ว',
          body: `${booking.event.name} · บูธ ${booking.booth.code} พร้อมให้คุณแบ่งปันประสบการณ์แล้ว`,
          relatedEntityType: REVIEW_NOTIFICATION_ENTITY_TYPE,
          relatedEntityId: booking.id,
        },
      ];
    });

    if (invitations.length === 0) return 0;

    const created = await transaction.notification.createMany({
      data: invitations,
    });
    return created.count;
  }

  /**
   * Prisma represents a PostgreSQL DATE as a JavaScript Date. This UTC-midnight
   * value is only a carrier for Bangkok's calendar date, not an instant in UTC;
   * it keeps the recipient rule correct between 00:00 and 06:59 Thailand time.
   */
  private bangkokCalendarDate(now = new Date()): Date {
    const parts = bangkokDateFormatter.formatToParts(now);
    const valueOf = (type: Intl.DateTimeFormatPartTypes) =>
      Number(parts.find((part) => part.type === type)?.value);

    return new Date(
      Date.UTC(valueOf('year'), valueOf('month') - 1, valueOf('day')),
    );
  }
}
