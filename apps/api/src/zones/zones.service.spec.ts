import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateZoneDto } from './dto/create-zone.dto';
import { UpdateZoneDto } from './dto/update-zone.dto';
import { ZoneResponse, ZonesService } from './zones.service';

const findMany = jest.fn();
const findUnique = jest.fn();
const create = jest.fn();
const update = jest.fn();
const deleteZone = jest.fn();
const mockPrismaService = {
  zone: {
    findMany,
    findUnique,
    create,
    update,
    delete: deleteZone,
  },
};

const venueId = '00000000-0000-4000-8000-000000000001';
const orgId = '00000000-0000-4000-8000-0000000000a1';
const zoneId = '00000000-0000-4000-8000-0000000000b1';
const createdAt = new Date('2026-01-01T00:00:00.000Z');
const updatedAt = new Date('2026-01-02T00:00:00.000Z');

/**
 * The row as `zoneSelect` projects it, and the shape the service is expected to
 * map it to. Decimal columns are real `Prisma.Decimal` values here because the
 * whole point of `toResponse` is that they leave as strings (§6.1).
 */
const ZONE_RECORD = {
  id: zoneId,
  venueId,
  code: 'A1',
  name: 'โซนอาหาร',
  description: null,
  defaultBoothPrice: new Prisma.Decimal('1500.00'),
  posX: new Prisma.Decimal('10.5000'),
  posY: null,
  imageUrls: null,
  createdAt,
  updatedAt,
};

const ZONE_RESPONSE: ZoneResponse = {
  id: zoneId,
  venueId,
  code: 'A1',
  name: 'โซนอาหาร',
  description: null,
  defaultBoothPrice: '1500',
  posX: '10.5',
  posY: null,
  imageUrls: null,
  createdAt,
  updatedAt,
};

describe('ZonesService', () => {
  let service: ZonesService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ZonesService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<ZonesService>(ZonesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('returns all zones when no venueId filter is provided', async () => {
    findMany.mockResolvedValue([ZONE_RECORD]);

    await expect(service.findAll()).resolves.toEqual([ZONE_RESPONSE]);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: undefined }),
    );
  });

  it('filters zones by venueId when provided', async () => {
    findMany.mockResolvedValue([ZONE_RECORD]);

    await expect(service.findAll({ venueId })).resolves.toEqual([
      ZONE_RESPONSE,
    ]);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { venueId } }),
    );
  });

  it('returns an empty list when venueId matches no zones', async () => {
    findMany.mockResolvedValue([]);

    await expect(service.findAll({ venueId })).resolves.toEqual([]);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { venueId } }),
    );
  });

  it('converts Decimal columns to strings rather than numbers', async () => {
    findMany.mockResolvedValue([ZONE_RECORD]);

    const [zone] = await service.findAll();

    expect(zone.defaultBoothPrice).toBe('1500');
    expect(zone.posX).toBe('10.5');
    expect(zone.posY).toBeNull();
  });

  it('maps a found zone through the response shape', async () => {
    findUnique.mockResolvedValue(ZONE_RECORD);

    await expect(service.findOne(zoneId)).resolves.toEqual(ZONE_RESPONSE);
  });

  // Unchanged behaviour: a public read that misses stays null rather than 404.
  it('returns null when the zone does not exist', async () => {
    findUnique.mockResolvedValue(null);

    await expect(service.findOne(zoneId)).resolves.toBeNull();
  });

  it('creates a zone with venueId from the argument, not the DTO', async () => {
    const dto: CreateZoneDto = { code: 'A1' };
    create.mockResolvedValue(ZONE_RECORD);

    await expect(service.create(venueId, dto)).resolves.toEqual(ZONE_RESPONSE);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ data: { code: 'A1', venueId } }),
    );
  });

  /*
   * §14.2: every org-scoped query names the org relation explicitly, so a zone
   * in another organization cannot be reached through these routes. A miss
   * raises P2025, which PrismaExceptionFilter turns into the same 404 the guard
   * gives — nothing is caught in the service.
   */
  it('scopes the update to the caller organization', async () => {
    const dto: UpdateZoneDto = { name: 'โซนอาหาร' };
    update.mockResolvedValue(ZONE_RECORD);

    await expect(service.update(zoneId, dto, orgId)).resolves.toEqual(
      ZONE_RESPONSE,
    );
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: zoneId, venue: { organizationId: orgId } },
        data: dto,
      }),
    );
  });

  it('scopes the delete to the caller organization', async () => {
    deleteZone.mockResolvedValue(ZONE_RECORD);

    await expect(service.remove(zoneId, orgId)).resolves.toEqual(ZONE_RESPONSE);
    expect(deleteZone).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: zoneId, venue: { organizationId: orgId } },
      }),
    );
  });
});
