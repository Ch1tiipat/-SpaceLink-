import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  BookingStatus,
  NotificationType,
  type Notification,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface CreateNotificationInput {
  type: NotificationType;
  title: string;
  body?: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
}

const bangkokDateFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Bangkok',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async createForUser(
    userId: string,
    input: CreateNotificationInput,
  ): Promise<Notification | null> {
    try {
      return await this.prisma.notification.create({
        data: { userId, ...input },
      });
    } catch {
      // Notification delivery is best-effort. Never include the title or body
      // here: they can contain user-visible details that do not belong in logs.
      this.logger.error('Failed to create an in-app notification');
      return null;
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
