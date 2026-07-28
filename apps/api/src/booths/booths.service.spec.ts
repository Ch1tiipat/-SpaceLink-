import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { BoothsService } from './booths.service';

const findMany = jest.fn();
const mockPrismaService = {
  booth: {
    findMany,
  },
};

const zoneId = '00000000-0000-4000-8000-000000000001';
const booths = [{ id: 'booth-1', zoneId }];

describe('BoothsService', () => {
  let service: BoothsService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BoothsService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<BoothsService>(BoothsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('returns all booths when no zoneId filter is provided', async () => {
    findMany.mockResolvedValue(booths);

    await expect(service.findAll()).resolves.toEqual(booths);
    expect(findMany).toHaveBeenCalledWith();
  });

  it('filters booths by zoneId when provided', async () => {
    findMany.mockResolvedValue(booths);

    await expect(service.findAll({ zoneId })).resolves.toEqual(booths);
    expect(findMany).toHaveBeenCalledWith({
      where: { zoneId },
    });
  });

  it('returns an empty list when zoneId matches no booths', async () => {
    findMany.mockResolvedValue([]);

    await expect(service.findAll({ zoneId })).resolves.toEqual([]);
    expect(findMany).toHaveBeenCalledWith({
      where: { zoneId },
    });
  });
});
