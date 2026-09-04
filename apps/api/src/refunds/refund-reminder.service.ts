import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  NotificationType,
  Prisma,
  RefundStatus,
  UserRole,
} from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';

const DAY = 24 * 60 * 60 * 1000;

@Injectable()
export class RefundReminderService {
  private readonly logger = new Logger(RefundReminderService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async remindOverdue(): Promise<void> {
    const now = new Date();
    const overdue: Prisma.RefundRequestWhereInput = {
      OR: [
        {
          status: RefundStatus.PENDING,
          createdAt: { lt: new Date(now.getTime() - DAY) },
        },
        {
          status: RefundStatus.APPROVED,
          reviewedAt: { lt: new Date(now.getTime() - 2 * DAY) },
        },
      ],
    };
    try {
      const refunds = await this.prisma.refundRequest.findMany({
        where: overdue,
        select: { id: true },
      });
      for (const { id } of refunds) {
        try {
          await this.prisma.$transaction(
            async (tx) => {
              // Serialize workers per refund without changing refund state.
              const locked = await tx.$queryRaw<{ id: string }[]>`
              SELECT refund_request_id AS id FROM refund_request
              WHERE refund_request_id = ${id}::uuid
              FOR UPDATE SKIP LOCKED
            `;
              if (!locked.length) return;
              const refund = await tx.refundRequest.findFirst({
                where: { id, ...overdue },
                select: {
                  status: true,
                  booking: {
                    select: { event: { select: { organizationId: true } } },
                  },
                },
              });
              if (!refund) return;
              const admins = await tx.orgMembership.findMany({
                where: {
                  organizationId: refund.booking.event.organizationId,
                  user: { role: UserRole.ORG_ADMIN },
                },
                select: { userId: true },
              });
              const recipients = new Set(admins.map(({ userId }) => userId));
              if (refund.status === RefundStatus.APPROVED) {
                const superAdmins = await tx.user.findMany({
                  where: { role: UserRole.SUPER_ADMIN },
                  select: { id: true },
                });
                superAdmins.forEach(({ id: userId }) => recipients.add(userId));
              }
              const title =
                refund.status === RefundStatus.PENDING
                  ? 'คำร้องคืนเงินรอตรวจสอบเกิน 1 วัน'
                  : 'คำร้องคืนเงินอนุมัติแล้วรอดำเนินการเกิน 2 วัน';
              for (const userId of recipients) {
                const previous = await tx.notification.findFirst({
                  where: {
                    userId,
                    type: NotificationType.REFUND,
                    relatedEntityType: 'REFUND_REQUEST',
                    relatedEntityId: id,
                    title,
                    createdAt: { gte: new Date(now.getTime() - DAY) },
                  },
                  select: { id: true },
                });
                if (previous) continue;
                // This service persists before returning; the row lock stays held until then.
                await this.notifications.createForUser(userId, {
                  type: NotificationType.REFUND,
                  title,
                  body: 'กรุณาตรวจสอบคำร้องคืนเงินในระบบ',
                  relatedEntityType: 'REFUND_REQUEST',
                  relatedEntityId: id,
                });
              }
            },
            { timeout: 30000 },
          );
        } catch {
          this.logger.error('Failed to send an overdue refund reminder');
        }
      }
    } catch {
      this.logger.error('Failed to query overdue refunds');
    }
  }
}
