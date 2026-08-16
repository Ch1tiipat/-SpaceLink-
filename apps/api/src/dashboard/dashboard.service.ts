import { Injectable } from '@nestjs/common';
import { BookingStatus, EventStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary(organizationId: string) {
    const now = new Date();
    const [
      pendingPayment,
      confirmed,
      cancelled,
      venues,
      zones,
      booths,
      published,
      upcoming,
    ] = await Promise.all([
      this.prisma.booking.count({
        where: {
          status: BookingStatus.PENDING_PAYMENT,
          event: { organizationId },
        },
      }),
      this.prisma.booking.count({
        where: {
          status: BookingStatus.CONFIRMED,
          event: { organizationId },
        },
      }),
      this.prisma.booking.count({
        where: {
          status: BookingStatus.CANCELLED,
          event: { organizationId },
        },
      }),
      this.prisma.venue.count({ where: { organizationId } }),
      this.prisma.zone.count({
        where: { venue: { organizationId } },
      }),
      this.prisma.booth.count({
        where: { zone: { venue: { organizationId } } },
      }),
      this.prisma.event.count({
        where: { organizationId, status: EventStatus.PUBLISHED },
      }),
      this.prisma.event.count({
        where: {
          organizationId,
          status: EventStatus.PUBLISHED,
          startDate: { gte: now },
        },
      }),
    ]);

    return {
      organizationId,
      bookings: { pendingPayment, confirmed, cancelled },
      resources: { venues, zones, booths },
      events: { published, upcoming },
    };
  }
}
