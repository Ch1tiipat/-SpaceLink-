import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  BookingStatus,
  CancelledByRole,
  NotificationType,
  PaymentGroupStatus,
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
    const expiredGroups = await this.prisma.bookingPaymentGroup.findMany({
      where: {
        status: PaymentGroupStatus.PENDING_PAYMENT,
        holdExpiresAt: { lt: cancelledAt },
      },
      select: {
        id: true,
        paymentCode: true,
        vendorUserId: true,
        bookings: {
          where: { status: BookingStatus.PENDING_PAYMENT },
          select: { id: true },
        },
      },
    });

    let cancelledCount = 0;

    for (const group of expiredGroups) {
      const groupCancelledCount = await this.prisma.$transaction(
        async (transaction) => {
          const updatedGroup = await transaction.bookingPaymentGroup.updateMany(
            {
              where: {
                id: group.id,
                status: PaymentGroupStatus.PENDING_PAYMENT,
                holdExpiresAt: { lt: cancelledAt },
                bookings: {
                  every: { status: BookingStatus.PENDING_PAYMENT },
                },
              },
              data: {
                status: PaymentGroupStatus.CANCELLED,
                cancelledAt,
              },
            },
          );
          if (updatedGroup.count !== 1) return 0;

          const updatedBookings = await transaction.booking.updateMany({
            where: {
              paymentGroupId: group.id,
              status: BookingStatus.PENDING_PAYMENT,
              holdExpiresAt: { lt: cancelledAt },
            },
            data: {
              status: BookingStatus.CANCELLED,
              cancelledByRole: CancelledByRole.SYSTEM,
              cancelledAt,
            },
          });
          if (updatedBookings.count !== group.bookings.length) {
            throw new Error('Payment group hold members changed during expiry');
          }
          return updatedBookings.count;
        },
      );
      if (groupCancelledCount === 0) continue;

      cancelledCount += groupCancelledCount;
      await this.notifications.createForUser(group.vendorUserId, {
        type: NotificationType.PAYMENT,
        title: 'กลุ่มการจองถูกยกเลิกเพราะไม่ชำระเงินทันเวลา',
        body: `${group.paymentCode} หมดเวลาชำระเงิน ระบบคืนบูธ ${groupCancelledCount} รายการให้ผู้ใช้อื่นแล้ว`,
        relatedEntityType: 'PAYMENT_GROUP',
        relatedEntityId: group.id,
      });
    }

    const expiredBookings = await this.prisma.booking.findMany({
      where: {
        paymentGroupId: null,
        status: BookingStatus.PENDING_PAYMENT,
        holdExpiresAt: { lt: cancelledAt },
      },
      select: {
        id: true,
        vendorUserId: true,
      },
    });

    for (const booking of expiredBookings) {
      const result = await this.prisma.booking.updateMany({
        where: {
          id: booking.id,
          paymentGroupId: null,
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
