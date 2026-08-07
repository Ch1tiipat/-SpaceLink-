import { Test, TestingModule } from '@nestjs/testing';
import { UserRole, type User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from './users.service';

const USER_ID = '00000000-0000-4000-8000-000000000001';
const USER_ROW: User = {
  id: USER_ID,
  authUserId: '00000000-0000-4000-8000-000000000002',
  email: 'vendor@example.com',
  fullName: 'Vendor One',
  phone: '0812345678',
  role: UserRole.VENDOR,
  isBlacklisted: false,
  blacklistReason: 'must stay private',
  createdAt: new Date('2026-08-01T00:00:00.000Z'),
  updatedAt: new Date('2026-08-01T00:00:00.000Z'),
};

const userUpdate = jest.fn();
const mockPrismaService = { user: { update: userUpdate } };

describe('UsersService', () => {
  let service: UsersService;

  beforeEach(async () => {
    jest.clearAllMocks();
    userUpdate.mockResolvedValue(USER_ROW);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('updateMe', () => {
    it('scopes the update to the authenticated user id', async () => {
      await service.updateMe({ phone: '0812345678' }, USER_ID);

      expect(userUpdate).toHaveBeenCalledWith({
        where: { id: USER_ID },
        data: { phone: '0812345678' },
      });
    });

    it('returns the shared profile shape without blacklistReason', async () => {
      await expect(
        service.updateMe({ phone: '0812345678' }, USER_ID),
      ).resolves.toEqual({
        id: USER_ID,
        authUserId: '00000000-0000-4000-8000-000000000002',
        email: 'vendor@example.com',
        fullName: 'Vendor One',
        phone: '0812345678',
        role: UserRole.VENDOR,
        isBlacklisted: false,
        createdAt: new Date('2026-08-01T00:00:00.000Z'),
        updatedAt: new Date('2026-08-01T00:00:00.000Z'),
      });
    });

    /*
     * An empty body is a no-op rather than an error: `data: {}` leaves every
     * column alone and only bumps `updatedAt`.
     */
    it('accepts an empty patch without touching any column', async () => {
      await service.updateMe({}, USER_ID);

      expect(userUpdate).toHaveBeenCalledWith({
        where: { id: USER_ID },
        data: {},
      });
    });
  });
});
