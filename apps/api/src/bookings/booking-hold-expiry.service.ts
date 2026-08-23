import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  BookingStatus,
  CancelledByRole,
  NotificationType,
} from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class BookingHoldExpiryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async cancelExpiredHolds(): Promise<number> {
    const cancelledAt = new Date();
    const expiredBookings = await this.prisma.booking.findMany({
      where: {
        status: BookingStatus.PENDING_PAYMENT,
        holdExpiresAt: { lt: cancelledAt },
      },
      select: {
        id: true,
        vendorUserId: true,
      },
    });

    let cancelledCount = 0;

    for (const booking of expiredBookings) {
      const result = await this.prisma.booking.updateMany({
        where: {
          id: booking.id,
          status: BookingStatus.PENDING_PAYMENT,
          holdExpiresAt: { lt: cancelledAt },
        },
        data: {
          status: BookingStatus.CANCELLED,
          cancelledByRole: CancelledByRole.SYSTEM,
          cancelledAt,
        },
      });

      // Multiple application instances can run the cron at the same minute.
      // Only the instance that actually changed this booking may notify it.
      if (result.count !== 1) continue;

      cancelledCount += 1;
      await this.notifications.createForUser(booking.vendorUserId, {
        type: NotificationType.PAYMENT,
        title: 'การจองถูกยกเลิกเพราะไม่ชำระเงินทันเวลา',
        body: 'ระบบคืนบูธให้ผู้ใช้อื่นแล้ว คุณสามารถเลือกบูธและสร้างการจองใหม่ได้',
        relatedEntityType: 'BOOKING',
        relatedEntityId: booking.id,
      });
    }

    return cancelledCount;
  }
}
