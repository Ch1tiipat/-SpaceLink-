import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { CategoriesService } from './categories.service';

const CATEGORIES = [
  { id: '11111111-1111-4111-8111-111111111111', name: 'งานฝีมือ' },
  { id: '22222222-2222-4222-8222-222222222222', name: 'อาหารและเครื่องดื่ม' },
];

const findMany = jest.fn();
const mockPrismaService = {
  productCategory: { findMany },
};

describe('CategoriesService', () => {
  let service: CategoriesService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CategoriesService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<CategoriesService>(CategoriesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  /*
   * The ordering and the select are the entire behaviour of this service, so
   * they are asserted exactly rather than through a partial matcher.
   */
  it('lists categories by name with only id and name selected', async () => {
    findMany.mockResolvedValue(CATEGORIES);

    await expect(service.findAll()).resolves.toEqual(CATEGORIES);
    expect(findMany).toHaveBeenCalledWith({
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    });
  });

  it('does not select description or icon', async () => {
    findMany.mockResolvedValue(CATEGORIES);

    await service.findAll();

    const [args] = findMany.mock.calls[0] as [
      { select: Record<string, boolean> },
    ];
    expect(args.select).not.toHaveProperty('description');
    expect(args.select).not.toHaveProperty('icon');
  });

  it('returns an empty list when there are no categories', async () => {
    findMany.mockResolvedValue([]);

    await expect(service.findAll()).resolves.toEqual([]);
  });
});
