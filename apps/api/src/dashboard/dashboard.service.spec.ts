import { BookingStatus, EventStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { DashboardService } from './dashboard.service';

const bookingCount = jest.fn();
const venueCount = jest.fn();
const zoneCount = jest.fn();
const boothCount = jest.fn();
const eventCount = jest.fn();

const prisma = {
  booking: { count: bookingCount },
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
    service = new DashboardService(prisma as unknown as PrismaService);
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

    const result = await service.getSummary(ORGANIZATION_ID);

    expect(result).toEqual({
      organizationId: ORGANIZATION_ID,
      bookings: { pendingPayment: 2, confirmed: 4, cancelled: 1 },
      resources: { venues: 3, zones: 8, booths: 24 },
      events: { published: 5, upcoming: 2 },
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
  });
});
