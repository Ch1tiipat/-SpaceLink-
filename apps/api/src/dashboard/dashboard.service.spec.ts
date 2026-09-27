import { BookingStatus, EventStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { DashboardService } from './dashboard.service';

const bookingCount = jest.fn();
const bookingFindMany = jest.fn();
const venueCount = jest.fn();
const zoneCount = jest.fn();
const boothCount = jest.fn();
const eventCount = jest.fn();

const prisma = {
  booking: { count: bookingCount, findMany: bookingFindMany },
  venue: { count: venueCount },
  zone: { count: zoneCount },
  booth: { count: boothCount },
  event: { count: eventCount },
};

const ORGANIZATION_ID = '11111111-1111-4111-8111-111111111111';

describe('DashboardService', () => {
  let service: DashboardService;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date('2026-09-28T05:00:00.000Z'));
    service = new DashboardService(prisma as unknown as PrismaService);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns organization-scoped booking, resource, and event counts', async () => {
    bookingCount
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(4)
      .mockResolvedValueOnce(1);
    venueCount.mockResolvedValue(3);
    zoneCount.mockResolvedValue(8);
    boothCount.mockResolvedValue(24);
    eventCount.mockResolvedValueOnce(5).mockResolvedValueOnce(2);
    bookingFindMany.mockResolvedValue([
      { createdAt: new Date('2026-09-28T01:00:00.000Z') },
      { createdAt: new Date('2026-09-22T18:00:00.000Z') },
      { createdAt: new Date('2026-09-08T05:00:00.000Z') },
      { createdAt: new Date('2026-01-15T05:00:00.000Z') },
    ]);

    const result = await service.getSummary(ORGANIZATION_ID);

    expect(result).toEqual(
      expect.objectContaining({
        organizationId: ORGANIZATION_ID,
        bookings: { pendingPayment: 2, confirmed: 4, cancelled: 1 },
        resources: { venues: 3, zones: 8, booths: 24 },
        events: { published: 5, upcoming: 2 },
      }),
    );
    expect(
      result.analytics.bookingTrend.day.reduce(
        (sum, point) => sum + point.value,
        0,
      ),
    ).toBe(1);
    expect(
      result.analytics.bookingTrend.week.reduce(
        (sum, point) => sum + point.value,
        0,
      ),
    ).toBe(2);
    expect(
      result.analytics.bookingTrend.month.reduce(
        (sum, point) => sum + point.value,
        0,
      ),
    ).toBe(3);
    expect(
      result.analytics.bookingTrend.year.reduce(
        (sum, point) => sum + point.value,
        0,
      ),
    ).toBe(4);
    expect(result.analytics.bookingTrend.day[2]).toEqual({
      label: '08:00',
      value: 1,
    });
    expect(bookingCount).toHaveBeenNthCalledWith(1, {
      where: {
        status: BookingStatus.PENDING_PAYMENT,
        event: { organizationId: ORGANIZATION_ID },
      },
    });
    expect(bookingCount).toHaveBeenNthCalledWith(2, {
      where: {
        status: BookingStatus.CONFIRMED,
        event: { organizationId: ORGANIZATION_ID },
      },
    });
    expect(bookingCount).toHaveBeenNthCalledWith(3, {
      where: {
        status: BookingStatus.CANCELLED,
        event: { organizationId: ORGANIZATION_ID },
      },
    });
    expect(venueCount).toHaveBeenCalledWith({
      where: { organizationId: ORGANIZATION_ID },
    });
    expect(zoneCount).toHaveBeenCalledWith({
      where: { venue: { organizationId: ORGANIZATION_ID } },
    });
    expect(boothCount).toHaveBeenCalledWith({
      where: { zone: { venue: { organizationId: ORGANIZATION_ID } } },
    });
    expect(eventCount).toHaveBeenNthCalledWith(1, {
      where: {
        organizationId: ORGANIZATION_ID,
        status: EventStatus.PUBLISHED,
      },
    });
    expect(eventCount).toHaveBeenNthCalledWith(2, {
      where: {
        organizationId: ORGANIZATION_ID,
        status: EventStatus.PUBLISHED,
        startDate: { gte: expect.any(Date) as Date },
      },
    });
    expect(bookingFindMany).toHaveBeenCalledWith({
      where: {
        createdAt: { gte: new Date('2025-09-30T17:00:00.000Z') },
        event: { organizationId: ORGANIZATION_ID },
      },
      select: { createdAt: true },
    });
  });
});
