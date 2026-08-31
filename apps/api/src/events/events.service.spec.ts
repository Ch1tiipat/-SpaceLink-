import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  BookingStatus,
  BoothStatus,
  EventStatus,
  Prisma,
} from '@prisma/client';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { EventsService } from './events.service';

const findUnique = jest.fn();
const findFirst = jest.fn();
const eventFindMany = jest.fn();
const eventUpdate = jest.fn();
const eventUpdateMany = jest.fn();
const eventDelete = jest.fn();
const eventCreate = jest.fn();
const zoneFindMany = jest.fn();
const zoneCount = jest.fn();
const venueFindFirst = jest.fn();
const platformConfigFindFirst = jest.fn();
const subscriptionCreate = jest.fn();
const transaction = jest.fn();

const mockPrismaService = {
  event: {
    findUnique,
    findFirst,
    findMany: eventFindMany,
    update: eventUpdate,
    updateMany: eventUpdateMany,
    delete: eventDelete,
    create: eventCreate,
  },
  zone: { findMany: zoneFindMany, count: zoneCount },
  venue: { findFirst: venueFindFirst },
  platformConfig: { findFirst: platformConfigFindFirst },
  subscription: { create: subscriptionCreate },
  $transaction: transaction,
};

const eventId = '00000000-0000-4000-8000-0000000000c1';
const orgId = '00000000-0000-4000-8000-0000000000a1';

describe('EventsService', () => {
  let service: EventsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    transaction.mockImplementation(
      (callback: (client: typeof mockPrismaService) => unknown) =>
        callback(mockPrismaService),
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventsService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<EventsService>(EventsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('lists organization events newest-first with venue display data', async () => {
    const events = [
      {
        id: eventId,
        organizationId: orgId,
        venue: { id: 'venue-1', name: 'Convention Center' },
        subscription: null,
      },
    ];
    eventFindMany.mockResolvedValue(events);

    await expect(service.findByOrganization(orgId)).resolves.toEqual(events);

    expect(eventFindMany).toHaveBeenCalledWith({
      where: { organizationId: orgId },
      orderBy: { startDate: 'desc' },
      include: {
        venue: { select: { id: true, name: true } },
        subscription: true,
      },
    });
  });

  describe('subscription billing', () => {
    const input = {
      venueId: '00000000-0000-4000-8000-0000000000b1',
      name: 'SUT Market',
      startDate: '2026-09-01',
      endDate: '2026-09-03',
    };

    beforeEach(() => {
      venueFindFirst.mockResolvedValue({ id: input.venueId, name: 'SUT' });
      zoneCount.mockResolvedValue(4);
      platformConfigFindFirst.mockResolvedValue(null);
    });

    it('quotes inclusive days with reasonable default rates', async () => {
      await expect(service.quoteSubscription(input, orgId)).resolves.toEqual({
        baseFee: '500',
        zoneCount: 4,
        perZoneRate: '50',
        eventDays: 3,
        perDayRate: '100',
        calculatedPrice: '1000',
        priceMin: '500',
        priceMax: '15000',
        finalPrice: '1000',
        isOverMax: false,
      });
      expect(venueFindFirst).toHaveBeenCalledWith({
        where: { id: input.venueId, organizationId: orgId },
        select: { id: true, name: true },
      });
    });

    it('creates a DRAFT event and DRAFT subscription atomically', async () => {
      eventCreate.mockResolvedValue({ id: eventId, ...input });
      subscriptionCreate.mockImplementation(({ data }) =>
        Promise.resolve({
          id: 'subscription-1',
          ...data,
          platformPaidAt: null,
          createdAt: new Date('2026-08-28T00:00:00Z'),
          updatedAt: new Date('2026-08-28T00:00:00Z'),
        }),
      );

      const result = await service.create(input, orgId);

      expect(eventCreate).toHaveBeenCalledWith({
        data: {
          organizationId: orgId,
          venueId: input.venueId,
          name: input.name,
          description: undefined,
          startDate: new Date('2026-09-01T00:00:00.000Z'),
          endDate: new Date('2026-09-03T00:00:00.000Z'),
          startTime: undefined,
          endTime: undefined,
          contactPhone: undefined,
          contactEmail: undefined,
          status: 'DRAFT',
        },
      });
      expect(subscriptionCreate).toHaveBeenCalledWith({
        data: {
          eventId,
          organizationId: orgId,
          status: 'DRAFT',
          baseFee: new Prisma.Decimal('500'),
          zoneCount: 4,
          perZoneRate: new Prisma.Decimal('50'),
          eventDays: 3,
          perDayRate: new Prisma.Decimal('100'),
          calculatedPrice: new Prisma.Decimal('1000'),
          priceMin: new Prisma.Decimal('500'),
          priceMax: new Prisma.Decimal('15000'),
          finalPrice: new Prisma.Decimal('1000'),
          isOverMax: false,
        },
      });
      expect(result.subscription.finalPrice).toBe('1000');
    });

    it('requires a new quote when the confirmed price no longer matches', async () => {
      await expect(
        service.create({ ...input, expectedFinalPrice: '999' }, orgId),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(eventCreate).not.toHaveBeenCalled();
      expect(subscriptionCreate).not.toHaveBeenCalled();
    });

    it('clamps the final price and records when the raw price exceeds max', async () => {
      platformConfigFindFirst.mockResolvedValue({
        baseFee: new Prisma.Decimal('1000'),
        perZoneRate: new Prisma.Decimal('1000'),
        perDayRate: new Prisma.Decimal('1000'),
        priceMin: new Prisma.Decimal('500'),
        priceMax: new Prisma.Decimal('2000'),
      });

      const result = await service.quoteSubscription(input, orgId);

      expect(result.calculatedPrice).toBe('8000');
      expect(result.finalPrice).toBe('2000');
      expect(result.isOverMax).toBe(true);
    });

    it('raises a low raw price to the configured minimum', async () => {
      zoneCount.mockResolvedValue(0);
      platformConfigFindFirst.mockResolvedValue({
        baseFee: new Prisma.Decimal('0'),
        perZoneRate: new Prisma.Decimal('0'),
        perDayRate: new Prisma.Decimal('0'),
        priceMin: new Prisma.Decimal('500'),
        priceMax: new Prisma.Decimal('2000'),
      });

      const result = await service.quoteSubscription(input, orgId);

      expect(result.calculatedPrice).toBe('0');
      expect(result.finalPrice).toBe('500');
      expect(result.isOverMax).toBe(false);
    });

    it('rejects an end date before the start date', async () => {
      await expect(
        service.quoteSubscription(
          { ...input, startDate: '2026-09-03', endDate: '2026-09-01' },
          orgId,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(venueFindFirst).not.toHaveBeenCalled();
    });

    it('returns 404 when the venue belongs to another organization', async () => {
      venueFindFirst.mockResolvedValue(null);

      await expect(
        service.quoteSubscription(input, orgId),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(zoneCount).not.toHaveBeenCalled();
    });
  });

  describe('findDiscovery', () => {
    it('returns only public discovery fields with unique categories', async () => {
      eventFindMany.mockResolvedValue([
        {
          id: 'event-1',
          name: 'Future Tech Expo',
          description: null,
          startDate: new Date('2026-09-10'),
          endDate: new Date('2026-09-12'),
          startTime: '09:00',
          endTime: '20:00',
          bannerUrl: null,
          status: 'PUBLISHED',
          organization: {
            id: 'org-1',
            name: 'SpaceLink University',
            logoUrl: null,
          },
          venue: {
            id: 'venue-1',
            name: 'Convention Center',
            address: 'Nakhon Ratchasima',
            zones: [
              {
                categories: [
                  {
                    category: {
                      id: 'category-1',
                      name: 'Technology',
                    },
                  },
                ],
              },
              {
                categories: [
                  {
                    category: {
                      id: 'category-1',
                      name: 'Technology',
                    },
                  },
                ],
              },
            ],
          },
        },
      ]);

      const result = await service.findDiscovery();

      expect(result[0]).toMatchObject({
        id: 'event-1',
        organization: { id: 'org-1', name: 'SpaceLink University' },
        venue: {
          id: 'venue-1',
          name: 'Convention Center',
          address: 'Nakhon Ratchasima',
        },
        categories: [{ id: 'category-1', name: 'Technology' }],
      });
      expect(result[0].venue).not.toHaveProperty('zones');
      expect(eventFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            status: { in: ['PUBLISHED', 'ONGOING'] },
            organization: { status: 'ACTIVE' },
          },
        }),
      );
    });

    it('filters discovery to active organizations', async () => {
      eventFindMany.mockResolvedValue([]);

      await service.findDiscovery();

      expect(eventFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            status: { in: ['PUBLISHED', 'ONGOING'] },
            organization: { status: 'ACTIVE' },
          },
        }),
      );
    });
  });

  describe('findMap', () => {
    it('returns a public map and converts booking state to availability', async () => {
      findFirst.mockResolvedValue({
        id: 'event-1',
        venueId: 'venue-1',
        name: 'SUT Agri Fair 2026',
        organization: {
          id: 'org-1',
          name: 'SUT',
          contactEmail: 'contact@example.com',
          contactPhone: null,
          logoUrl: null,
          orgConfig: {
            tierThresholds: { S: 2000, A: 1500, B: 1000 },
          },
        },
        venue: { id: 'venue-1', name: 'SUT', address: null },
        policy: null,
      });
      zoneFindMany.mockResolvedValue([
        {
          id: 'zone-1',
          code: 'A',
          name: 'โซนอาหาร',
          description: null,
          posX: new Prisma.Decimal('10.5'),
          posY: null,
          categories: [{ category: { id: 'category-1', name: 'อาหาร' } }],
          booths: [
            {
              id: 'booth-a1',
              zoneId: 'zone-1',
              code: 'A01',
              boothPrice: new Prisma.Decimal('1500.00'),
              widthM: new Prisma.Decimal('3'),
              heightM: new Prisma.Decimal('3'),
              posX: null,
              posY: null,
              status: BoothStatus.AVAILABLE,
              bookings: [],
            },
            {
              id: 'booth-a2',
              zoneId: 'zone-1',
              code: 'A02',
              boothPrice: new Prisma.Decimal('1800.00'),
              widthM: null,
              heightM: null,
              posX: null,
              posY: null,
              status: BoothStatus.AVAILABLE,
              bookings: [
                {
                  status: BookingStatus.CONFIRMED,
                  shop: {
                    id: 'shop-1',
                    name: 'ร้านกาแฟอรุณ',
                    logoUrl: 'https://example.com/shop-logo.png',
                  },
                },
              ],
            },
          ],
        },
      ]);

      const result = await service.findMap('event-1');

      expect(result.zones[0]).toMatchObject({
        posX: '10.5',
        categories: [{ id: 'category-1', name: 'อาหาร' }],
        booths: [
          {
            code: 'A01',
            boothPrice: '1500',
            widthM: '3',
            availability: 'AVAILABLE',
            tier: 'A',
          },
          {
            code: 'A02',
            boothPrice: '1800',
            availability: 'BOOKED',
            occupant: {
              id: 'shop-1',
              name: 'ร้านกาแฟอรุณ',
              logoUrl: 'https://example.com/shop-logo.png',
            },
          },
        ],
      });
      expect(result.zones[0].booths[1]).not.toHaveProperty('bookings');
    });

    it('marks a pending-payment booking as held', async () => {
      findFirst.mockResolvedValue({
        id: 'event-1',
        venueId: 'venue-1',
        organization: {
          id: 'org-1',
          name: 'SUT',
          contactEmail: 'contact@example.com',
          contactPhone: null,
          logoUrl: null,
          orgConfig: null,
        },
        venue: { id: 'venue-1', name: 'SUT', address: null },
        policy: null,
      });
      zoneFindMany.mockResolvedValue([
        {
          id: 'zone-1',
          code: 'A',
          name: null,
          description: null,
          posX: null,
          posY: null,
          categories: [],
          booths: [
            {
              id: 'booth-a1',
              zoneId: 'zone-1',
              code: 'A01',
              boothPrice: new Prisma.Decimal('1500'),
              widthM: null,
              heightM: null,
              posX: null,
              posY: null,
              status: BoothStatus.AVAILABLE,
              bookings: [
                {
                  status: BookingStatus.PENDING_PAYMENT,
                  shop: {
                    id: 'shop-1',
                    name: 'ร้านกาแฟอรุณ',
                    logoUrl: 'https://example.com/shop-logo.png',
                  },
                },
              ],
            },
          ],
        },
      ]);

      const result = await service.findMap('event-1');

      expect(result.zones[0].booths[0].availability).toBe('HELD');
      expect(result.zones[0].booths[0].occupant).toBeNull();
    });

    it('throws 404 when the event does not exist', async () => {
      findFirst.mockResolvedValue(null);

      await expect(service.findMap('missing')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(zoneFindMany).not.toHaveBeenCalled();
    });

    it('returns 404 when the organization is not active', async () => {
      findFirst.mockResolvedValue(null);

      await expect(service.findMap('suspended-event')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            id: 'suspended-event',
            status: { in: ['PUBLISHED', 'ONGOING'] },
            organization: { status: 'ACTIVE' },
          },
        }),
      );
      expect(zoneFindMany).not.toHaveBeenCalled();
    });
  });

  /*
   * These assert the shape of the `where` clause, not that it blocks anything.
   * No route calls either method yet; what is pinned here is the §14.2
   * requirement that the query names the org column explicitly — see the
   * comment on EventsService.update.
   */
  it('scopes the update to the caller organization', async () => {
    const dto = { name: 'SUT Agri Fair 2026' };
    eventUpdate.mockResolvedValue({ id: eventId });

    await service.update(eventId, dto, orgId);

    expect(eventUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: eventId, organizationId: orgId },
        data: dto,
      }),
    );
  });

  it('publishes a draft event within the caller organization', async () => {
    eventUpdateMany.mockResolvedValue({ count: 1 });
    findFirst.mockResolvedValue({
      id: eventId,
      status: EventStatus.PUBLISHED,
      venue: { id: 'venue-1', name: 'Convention Center' },
      subscription: null,
    });

    await expect(service.publish(eventId, orgId)).resolves.toEqual(
      expect.objectContaining({
        id: eventId,
        status: EventStatus.PUBLISHED,
      }),
    );
    expect(eventUpdateMany).toHaveBeenCalledWith({
      where: {
        id: eventId,
        organizationId: orgId,
        status: EventStatus.DRAFT,
      },
      data: { status: EventStatus.PUBLISHED },
    });
    expect(findFirst).toHaveBeenCalledWith({
      where: { id: eventId, organizationId: orgId },
      include: {
        venue: { select: { id: true, name: true } },
        subscription: true,
      },
    });
  });

  it('answers 404 when publishing an event outside the caller organization', async () => {
    eventUpdateMany.mockResolvedValue({ count: 0 });
    findFirst.mockResolvedValue(null);

    await expect(service.publish(eventId, orgId)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(findFirst).toHaveBeenCalledWith({
      where: { id: eventId, organizationId: orgId },
      select: { status: true },
    });
  });

  it('rejects publishing an event that is no longer a draft', async () => {
    eventUpdateMany.mockResolvedValue({ count: 0 });
    findFirst.mockResolvedValue({ status: EventStatus.PUBLISHED });

    await expect(service.publish(eventId, orgId)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('allows only one concurrent publish transition to succeed', async () => {
    eventUpdateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 });
    findFirst
      .mockResolvedValueOnce({
        id: eventId,
        status: EventStatus.PUBLISHED,
        venue: { id: 'venue-1', name: 'Convention Center' },
        subscription: null,
      })
      .mockResolvedValueOnce({ status: EventStatus.PUBLISHED });

    const results = await Promise.allSettled([
      service.publish(eventId, orgId),
      service.publish(eventId, orgId),
    ]);

    expect(
      results.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1);
    expect(
      results.filter((result) => result.status === 'rejected'),
    ).toHaveLength(1);
    expect(eventUpdateMany).toHaveBeenCalledTimes(2);
  });

  it('scopes the delete to the caller organization', async () => {
    eventDelete.mockResolvedValue({ id: eventId });

    await service.remove(eventId, orgId);

    expect(eventDelete).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: eventId, organizationId: orgId },
      }),
    );
  });
});
