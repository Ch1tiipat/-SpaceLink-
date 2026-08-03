import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { BookingStatus, CancelledByRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class BookingHoldExpiryService {
  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async cancelExpiredHolds(): Promise<number> {
    const cancelledAt = new Date();
    const result = await this.prisma.booking.updateMany({
      where: {
        status: BookingStatus.PENDING_PAYMENT,
        holdExpiresAt: { lt: cancelledAt },
      },
      data: {
        status: BookingStatus.CANCELLED,
        cancelledByRole: CancelledByRole.SYSTEM,
        cancelledAt,
      },
    });

    return result.count;
  }
}
