import { NotFoundException } from '@nestjs/common';
import { BookingStatus, BoothStatus, Prisma } from '@prisma/client';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { EventsService } from './events.service';

const findUnique = jest.fn();
const findMany = jest.fn();

const mockPrismaService = {
  event: { findUnique },
  zone: { findMany },
};

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

  describe('findMap', () => {
    it('returns a public map and converts booking state to availability', async () => {
      findUnique.mockResolvedValue({
        id: 'event-1',
        venueId: 'venue-1',
        name: 'SUT Agri Fair 2026',
        venue: { id: 'venue-1', name: 'SUT', address: null },
        policy: null,
      });
      findMany.mockResolvedValue([
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
      findUnique.mockResolvedValue({
        id: 'event-1',
        venueId: 'venue-1',
        venue: { id: 'venue-1', name: 'SUT', address: null },
        policy: null,
      });
      findMany.mockResolvedValue([
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
      findUnique.mockResolvedValue(null);

      await expect(service.findMap('missing')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(findMany).not.toHaveBeenCalled();
    });
  });
});
