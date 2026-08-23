import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import {
  OrganizationsService,
  PUBLIC_ORGANIZATION_SELECT,
} from './organizations.service';

const organizationFindMany = jest.fn();
const organizationFindUnique = jest.fn();
const organizationCreate = jest.fn();
const organizationUpdate = jest.fn();
const mockPrismaService = {
  organization: {
    findMany: organizationFindMany,
    findUnique: organizationFindUnique,
    create: organizationCreate,
    update: organizationUpdate,
  },
};

describe('OrganizationsService', () => {
  let service: OrganizationsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrganizationsService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<OrganizationsService>(OrganizationsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('creates an active organization with private PromptPay returned', async () => {
    const dto = {
      name: 'ตลาดนัดมหาวิทยาลัย',
      contactEmail: 'admin@example.com',
      contactPhone: '0812345678',
      promptpayId: '0812345678',
    };
    organizationCreate.mockResolvedValue({
      id: '00000000-0000-4000-8000-000000000001',
      ...dto,
      status: 'ACTIVE',
    });

    await service.create(dto);

    expect(organizationCreate).toHaveBeenCalledWith({
      data: dto,
      select: {
        ...PUBLIC_ORGANIZATION_SELECT,
        promptpayId: true,
      },
    });
  });

  it('never exposes promptpayId from public organization reads', async () => {
    organizationFindMany.mockResolvedValue([]);
    organizationFindUnique.mockResolvedValue(null);

    await service.findAll();
    await service.findOne('00000000-0000-4000-8000-000000000001');

    expect(PUBLIC_ORGANIZATION_SELECT).not.toHaveProperty('promptpayId');
    expect(organizationFindMany).toHaveBeenCalledWith({
      select: PUBLIC_ORGANIZATION_SELECT,
    });
    expect(organizationFindUnique).toHaveBeenCalledWith({
      where: { id: '00000000-0000-4000-8000-000000000001' },
      select: PUBLIC_ORGANIZATION_SELECT,
    });
  });

  it('updates PromptPay only on the guard-resolved organization', async () => {
    const id = '00000000-0000-4000-8000-000000000001';
    organizationUpdate.mockResolvedValue({ id, promptpayId: '0812345678' });

    await service.update(id, { promptpayId: '0812345678' });

    expect(organizationUpdate).toHaveBeenCalledWith({
      where: { id },
      data: { promptpayId: '0812345678' },
      select: {
        ...PUBLIC_ORGANIZATION_SELECT,
        promptpayId: true,
      },
    });
  });
});
