import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { ZonesService } from './zones.service';

const findMany = jest.fn();
const mockPrismaService = {
  zone: {
    findMany,
  },
};

const venueId = '00000000-0000-4000-8000-000000000001';
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
});
