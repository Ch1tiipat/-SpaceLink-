import { Injectable } from '@nestjs/common';
import { BookingStatus, EventStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const THAI_SHORT_MONTHS = [
  'ม.ค.',
  'ก.พ.',
  'มี.ค.',
  'เม.ย.',
  'พ.ค.',
  'มิ.ย.',
  'ก.ค.',
  'ส.ค.',
  'ก.ย.',
  'ต.ค.',
  'พ.ย.',
  'ธ.ค.',
] as const;

type TrendPoint = { label: string; value: number };

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
      trendBookings,
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
      this.prisma.booking.findMany({
        where: {
          createdAt: { gte: trendStart(now) },
          event: { organizationId },
        },
        select: { createdAt: true },
      }),
    ]);

    return {
      organizationId,
      bookings: { pendingPayment, confirmed, cancelled },
      resources: { venues, zones, booths },
      events: { published, upcoming },
      analytics: { bookingTrend: buildBookingTrend(trendBookings, now) },
    };
  }
}

function buildBookingTrend(rows: Array<{ createdAt: Date }>, now: Date) {
  const current = bangkokParts(now);
  const day: TrendPoint[] = Array.from({ length: 6 }, (_, index) => ({
    label: `${String(index * 4).padStart(2, '0')}:00`,
    value: 0,
  }));
  const weekDates = Array.from({ length: 7 }, (_, index) =>
    shiftedBangkokDate(current, index - 6),
  );
  const week: TrendPoint[] = weekDates.map((date) => ({
    label: `${date.getUTCDate()} ${THAI_SHORT_MONTHS[date.getUTCMonth()]}`,
    value: 0,
  }));
  const month: TrendPoint[] = Array.from({ length: 4 }, (_, index) => ({
    label: `สัปดาห์ ${index + 1}`,
    value: 0,
  }));
  const yearMonths = Array.from({ length: 12 }, (_, index) => {
    const date = new Date(
      Date.UTC(current.year, current.month + index - 11, 1),
    );
    return { year: date.getUTCFullYear(), month: date.getUTCMonth() };
  });
  const year: TrendPoint[] = yearMonths.map(({ month: monthIndex }) => ({
    label: THAI_SHORT_MONTHS[monthIndex],
    value: 0,
  }));

  const todayKey = dateKey(current.year, current.month, current.day);
  const weekIndexByKey = new Map(
    weekDates.map((date, index) => [
      dateKey(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
      index,
    ]),
  );
  const currentDayNumber = Date.UTC(current.year, current.month, current.day);
  const yearIndexByKey = new Map(
    yearMonths.map(({ year: yearValue, month: monthValue }, index) => [
      monthKey(yearValue, monthValue),
      index,
    ]),
  );

  for (const row of rows) {
    const created = bangkokParts(row.createdAt);
    const createdDateKey = dateKey(created.year, created.month, created.day);
    if (createdDateKey === todayKey) {
      day[Math.floor(created.hour / 4)].value += 1;
    }

    const weekIndex = weekIndexByKey.get(createdDateKey);
    if (weekIndex !== undefined) week[weekIndex].value += 1;

    const createdDayNumber = Date.UTC(created.year, created.month, created.day);
    const daysAgo = Math.floor((currentDayNumber - createdDayNumber) / DAY_MS);
    if (daysAgo >= 0 && daysAgo < 28) {
      month[3 - Math.floor(daysAgo / 7)].value += 1;
    }

    const yearIndex = yearIndexByKey.get(monthKey(created.year, created.month));
    if (yearIndex !== undefined) year[yearIndex].value += 1;
  }

  return { day, week, month, year };
}

function trendStart(now: Date) {
  const current = bangkokParts(now);
  return new Date(
    Date.UTC(current.year, current.month - 11, 1) - BANGKOK_OFFSET_MS,
  );
}

function bangkokParts(date: Date) {
  const shifted = new Date(date.getTime() + BANGKOK_OFFSET_MS);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth(),
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
  };
}

function shiftedBangkokDate(
  current: ReturnType<typeof bangkokParts>,
  days: number,
) {
  return new Date(Date.UTC(current.year, current.month, current.day + days));
}

function dateKey(year: number, month: number, day: number) {
  return `${year}-${month}-${day}`;
}

function monthKey(year: number, month: number) {
  return `${year}-${month}`;
}
