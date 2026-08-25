import { NotFoundException } from '@nestjs/common';
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

const userFindMany = jest.fn();
const userFindUnique = jest.fn();
const userUpdate = jest.fn();
const mockPrismaService = {
  user: {
    findMany: userFindMany,
    findUnique: userFindUnique,
    update: userUpdate,
  },
};

const DETAIL_USER = {
  id: USER_ID,
  email: 'vendor@example.com',
  fullName: 'Vendor One',
  phone: '0812345678',
  role: UserRole.VENDOR,
  isBlacklisted: true,
  blacklistReason: 'Repeated no-shows',
  createdAt: new Date('2026-08-01T00:00:00.000Z'),
  updatedAt: new Date('2026-08-02T00:00:00.000Z'),
  shops: [
    {
      id: 'shop-1',
      name: 'Test Shop',
      description: 'Test description',
      logoUrl: null,
      createdAt: new Date('2026-08-01T00:00:00.000Z'),
    },
  ],
  bookingsPlaced: [
    {
      id: 'booking-1',
      bookingCode: 'BK-1',
      status: 'CONFIRMED',
      boothPrice: { toString: () => '1500.00' },
      bookingStartDate: new Date('2026-09-01T00:00:00.000Z'),
      bookingEndDate: new Date('2026-09-01T00:00:00.000Z'),
      createdAt: new Date('2026-08-03T00:00:00.000Z'),
      event: { id: 'event-1', name: 'Test Event' },
      shop: { id: 'shop-1', name: 'Test Shop' },
    },
  ],
  refundsRequested: [
    {
      id: 'refund-1',
      reason: 'Full refund',
      requestedAmount: { toString: () => '500.00' },
      approvedAmount: { toString: () => '400.00' },
      status: 'APPROVED',
      createdAt: new Date('2026-08-04T00:00:00.000Z'),
      booking: { id: 'booking-1', bookingCode: 'BK-1' },
    },
    {
      id: 'refund-2',
      reason: 'Pending refund',
      requestedAmount: { toString: () => '250.00' },
      approvedAmount: null,
      status: 'PENDING',
      createdAt: new Date('2026-08-05T00:00:00.000Z'),
      booking: { id: 'booking-1', bookingCode: 'BK-1' },
    },
  ],
  penalties: [
    {
      id: 'penalty-1',
      reason: 'NO_SHOW',
      description: 'Missed event',
      points: 1,
      issuedAt: new Date('2026-08-06T00:00:00.000Z'),
      organization: { id: 'organization-1', name: 'Test Organization' },
    },
  ],
  supportTickets: [
    {
      id: 'ticket-1',
      type: 'GENERAL_INQUIRY',
      subject: 'Need help',
      status: 'OPEN',
      createdAt: new Date('2026-08-07T00:00:00.000Z'),
    },
  ],
};

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

  describe('findAll', () => {
    it('selects only the admin list fields ordered by newest user first', async () => {
      userFindMany.mockResolvedValue([]);

      await service.findAll();

      expect(userFindMany).toHaveBeenCalledWith({
        select: {
          id: true,
          email: true,
          fullName: true,
          role: true,
          isBlacklisted: true,
        },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('never exposes authUserId or blacklistReason in the list response', async () => {
      userFindMany.mockResolvedValue([
        {
          id: USER_ID,
          email: 'vendor@example.com',
          fullName: 'Vendor One',
          role: UserRole.VENDOR,
          isBlacklisted: false,
        },
      ]);

      const result = await service.findAll();

      expect(result[0]).not.toHaveProperty('authUserId');
      expect(result[0]).not.toHaveProperty('blacklistReason');
    });
  });

  describe('findOne', () => {
    beforeEach(() => userFindUnique.mockResolvedValue(DETAIL_USER));

    it('selects the admin detail fields and all five relation groups', async () => {
      await service.findOne(USER_ID);

      expect(userFindUnique).toHaveBeenCalledWith({
        where: { id: USER_ID },
        select: {
          id: true,
          email: true,
          fullName: true,
          phone: true,
          role: true,
          isBlacklisted: true,
          blacklistReason: true,
          createdAt: true,
          updatedAt: true,
          shops: {
            select: {
              id: true,
              name: true,
              description: true,
              logoUrl: true,
              createdAt: true,
            },
            orderBy: { createdAt: 'desc' },
          },
          bookingsPlaced: {
            select: {
              id: true,
              bookingCode: true,
              status: true,
              boothPrice: true,
              bookingStartDate: true,
              bookingEndDate: true,
              createdAt: true,
              event: { select: { id: true, name: true } },
              shop: { select: { id: true, name: true } },
            },
            orderBy: { createdAt: 'desc' },
          },
          refundsRequested: {
            select: {
              id: true,
              reason: true,
              requestedAmount: true,
              approvedAmount: true,
              status: true,
              createdAt: true,
              booking: { select: { id: true, bookingCode: true } },
            },
            orderBy: { createdAt: 'desc' },
          },
          penalties: {
            select: {
              id: true,
              reason: true,
              description: true,
              points: true,
              issuedAt: true,
              organization: { select: { id: true, name: true } },
            },
            orderBy: { issuedAt: 'desc' },
          },
          supportTickets: {
            select: {
              id: true,
              type: true,
              subject: true,
              status: true,
              createdAt: true,
            },
            orderBy: { createdAt: 'desc' },
          },
        },
      });
    });

    it('throws NotFoundException for a missing user', async () => {
      userFindUnique.mockResolvedValue(null);

      await expect(service.findOne(USER_ID)).rejects.toThrow(
        new NotFoundException('ไม่พบผู้ใช้'),
      );
    });

    it('renames relation arrays and converts every money field to a string', async () => {
      const result = await service.findOne(USER_ID);

      expect(result.bookings[0].boothPrice).toBe('1500.00');
      expect(result.refunds[0]).toMatchObject({
        requestedAmount: '500.00',
        approvedAmount: '400.00',
      });
      expect(result.refunds[1]).toMatchObject({
        requestedAmount: '250.00',
        approvedAmount: null,
      });
      expect(result).not.toHaveProperty('bookingsPlaced');
      expect(result).not.toHaveProperty('refundsRequested');
    });

    it('keeps admin detail relations and blacklist reason without authUserId', async () => {
      const result = await service.findOne(USER_ID);

      expect(result.shops).toEqual(DETAIL_USER.shops);
      expect(result.penalties).toEqual(DETAIL_USER.penalties);
      expect(result.supportTickets).toEqual(DETAIL_USER.supportTickets);
      expect(result.blacklistReason).toBe('Repeated no-shows');
      expect(result).not.toHaveProperty('authUserId');
    });
  });

  describe('getAuthUserId', () => {
    it('returns the authUserId for an existing user', async () => {
      userFindUnique.mockResolvedValue({ authUserId: 'auth-user-1' });

      await expect(service.getAuthUserId(USER_ID)).resolves.toBe('auth-user-1');
      expect(userFindUnique).toHaveBeenCalledWith({
        where: { id: USER_ID },
        select: { authUserId: true },
      });
    });

    it('throws NotFoundException when the user does not exist', async () => {
      userFindUnique.mockResolvedValue(null);

      await expect(service.getAuthUserId(USER_ID)).rejects.toThrow(
        NotFoundException,
      );
    });
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
