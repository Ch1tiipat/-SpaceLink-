import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { CreateZoneDto } from './dto/create-zone.dto';
import { UpdateZoneDto } from './dto/update-zone.dto';
import { ZonesService } from './zones.service';

const findMany = jest.fn();
const create = jest.fn();
const update = jest.fn();
const deleteZone = jest.fn();
const mockPrismaService = {
  zone: {
    findMany,
    create,
    update,
    delete: deleteZone,
  },
};

const venueId = '00000000-0000-4000-8000-000000000001';
const orgId = '00000000-0000-4000-8000-0000000000a1';
const zoneId = '00000000-0000-4000-8000-0000000000b1';
const zones = [{ id: 'zone-1', venueId }];

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
    findMany.mockResolvedValue(zones);

    await expect(service.findAll()).resolves.toEqual(zones);
    expect(findMany).toHaveBeenCalledWith();
  });

  it('filters zones by venueId when provided', async () => {
    findMany.mockResolvedValue(zones);

    await expect(service.findAll({ venueId })).resolves.toEqual(zones);
    expect(findMany).toHaveBeenCalledWith({
      where: { venueId },
    });
  });

  it('returns an empty list when venueId matches no zones', async () => {
    findMany.mockResolvedValue([]);

    await expect(service.findAll({ venueId })).resolves.toEqual([]);
    expect(findMany).toHaveBeenCalledWith({
      where: { venueId },
    });
  });

  it('creates a zone with venueId from the argument, not the DTO', async () => {
    const dto: CreateZoneDto = { code: 'A1' };
    const created = { id: 'zone-1', venueId, code: 'A1' };
    create.mockResolvedValue(created);

    await expect(service.create(venueId, dto)).resolves.toEqual(created);
    expect(create).toHaveBeenCalledWith({
      data: { code: 'A1', venueId },
    });
  });

  /*
   * §14.2: every org-scoped query names the org relation explicitly, so a zone
   * in another organization cannot be reached through these routes. A miss
   * raises P2025, which PrismaExceptionFilter turns into the same 404 the guard
   * gives — nothing is caught in the service.
   */
  it('scopes the update to the caller organization', async () => {
    const dto: UpdateZoneDto = { name: 'โซนอาหาร' };
    const updated = { id: zoneId, venueId, name: 'โซนอาหาร' };
    update.mockResolvedValue(updated);

    await expect(service.update(zoneId, dto, orgId)).resolves.toEqual(updated);
    expect(update).toHaveBeenCalledWith({
      where: { id: zoneId, venue: { organizationId: orgId } },
      data: dto,
    });
  });

  it('scopes the delete to the caller organization', async () => {
    const removed = { id: zoneId, venueId };
    deleteZone.mockResolvedValue(removed);

    await expect(service.remove(zoneId, orgId)).resolves.toEqual(removed);
    expect(deleteZone).toHaveBeenCalledWith({
      where: { id: zoneId, venue: { organizationId: orgId } },
    });
  });
});
