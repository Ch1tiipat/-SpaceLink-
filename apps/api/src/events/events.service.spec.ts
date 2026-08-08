import { NotFoundException } from '@nestjs/common';
import { BookingStatus, BoothStatus, Prisma } from '@prisma/client';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { EventsService } from './events.service';

const findUnique = jest.fn();
const findFirst = jest.fn();
const eventFindMany = jest.fn();
const eventUpdate = jest.fn();
const eventDelete = jest.fn();
const zoneFindMany = jest.fn();

const mockPrismaService = {
  event: {
    findUnique,
    findFirst,
    findMany: eventFindMany,
    update: eventUpdate,
    delete: eventDelete,
  },
  zone: { findMany: zoneFindMany },
};

const eventId = '00000000-0000-4000-8000-0000000000c1';
const orgId = '00000000-0000-4000-8000-0000000000a1';

describe('EventsService', () => {
  let service: EventsService;

  beforeEach(async () => {
    jest.clearAllMocks();

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
              bookings: [{ status: BookingStatus.CONFIRMED }],
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
              bookings: [{ status: BookingStatus.PENDING_PAYMENT }],
            },
          ],
        },
      ]);

      const result = await service.findMap('event-1');

      expect(result.zones[0].booths[0].availability).toBe('HELD');
    });

    it('throws 404 when the event does not exist', async () => {
      findFirst.mockResolvedValue(null);

      await expect(service.findMap('missing')).rejects.toBeInstanceOf(
        NotFoundException,
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
