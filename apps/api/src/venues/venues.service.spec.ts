import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { VenuesService } from './venues.service';

const findMany = jest.fn();
const mockPrismaService = {
  venue: {
    findMany,
  },
};

const organizationId = '00000000-0000-4000-8000-000000000001';
const venues = [{ id: 'venue-1', organizationId }];

describe('VenuesService', () => {
  let service: VenuesService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VenuesService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<VenuesService>(VenuesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('returns all venues when no organizationId filter is provided', async () => {
    findMany.mockResolvedValue(venues);

    await expect(service.findAll()).resolves.toEqual(venues);
    expect(findMany).toHaveBeenCalledWith();
  });

  it('filters venues by organizationId when provided', async () => {
    findMany.mockResolvedValue(venues);

    await expect(service.findAll({ organizationId })).resolves.toEqual(venues);
    expect(findMany).toHaveBeenCalledWith({
      where: { organizationId },
    });
  });

  it('returns an empty list when organizationId matches no venues', async () => {
    findMany.mockResolvedValue([]);

    await expect(service.findAll({ organizationId })).resolves.toEqual([]);
    expect(findMany).toHaveBeenCalledWith({
      where: { organizationId },
    });
  });
});
