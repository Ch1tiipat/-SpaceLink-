import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import {
  NotificationType,
  PenaltyReason,
  Prisma,
  UserRole,
  type Penalty,
} from '@prisma/client';
import {
  type CreateNotificationInput,
  NotificationsService,
} from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAdminPenaltyDto } from './dto/create-admin-penalty.dto';
import { CreatePenaltyDto } from './dto/create-penalty.dto';
import { PenaltiesService } from './penalties.service';

const bookingId = '11111111-1111-4111-8111-111111111111';
const organizationId = '22222222-2222-4222-8222-222222222222';
const vendorUserId = '33333333-3333-4333-8333-333333333333';
const penaltyId = '44444444-4444-4444-8444-444444444444';
const issuedAt = new Date('2026-08-17T00:00:00.000Z');
const dto: CreatePenaltyDto = {
  reason: PenaltyReason.NO_SHOW,
  description: 'ไม่มาใช้พื้นที่ตามที่จอง',
};

const bookingFindFirst = jest.fn();
const organizationFindUnique = jest.fn();
const penaltyCreate = jest.fn<
  Penalty,
  [{ data: Prisma.PenaltyUncheckedCreateInput }]
>();
const penaltyFindMany = jest.fn();
const userFindFirst = jest.fn();
const userFindMany = jest.fn();
const userUpdate = jest.fn();
const prismaTransaction = jest.fn();
const createForUser = jest.fn<
  Promise<null>,
  [string, CreateNotificationInput]
>();
const transactionClient = {
  booking: { findFirst: bookingFindFirst },
  organization: { findUnique: organizationFindUnique },
  penalty: { create: penaltyCreate },
  user: {
    findFirst: userFindFirst,
    update: userUpdate,
  },
};
const mockNotificationsService = { createForUser };
const mockPrismaService = {
  booking: { findFirst: bookingFindFirst },
  penalty: { findMany: penaltyFindMany },
  user: { findMany: userFindMany },
  $transaction: prismaTransaction,
};

describe('PenaltiesService', () => {
  let service: PenaltiesService;

  beforeEach(async () => {
    jest.clearAllMocks();
    bookingFindFirst.mockResolvedValue({
      vendorUserId,
      vendor: { trustScore: 100, isBlacklisted: false },
    });
    organizationFindUnique.mockResolvedValue({ id: organizationId });
    userFindFirst.mockResolvedValue({
      trustScore: 100,
      isBlacklisted: false,
    });
    penaltyCreate.mockImplementation(
      (args: { data: Prisma.PenaltyUncheckedCreateInput }): Penalty => ({
        id: penaltyId,
        organizationId: args.data.organizationId,
        userId: args.data.userId,
        bookingId: args.data.bookingId ?? null,
        reason: args.data.reason,
        description: args.data.description ?? null,
        points: args.data.points ?? 1,
        issuedAt,
        createdAt: issuedAt,
      }),
    );
    penaltyFindMany.mockResolvedValue([]);
    userFindMany.mockResolvedValue([]);
    userUpdate.mockResolvedValue({ id: vendorUserId });
    createForUser.mockResolvedValue(null);
    prismaTransaction.mockImplementation(
      (operation: (client: Prisma.TransactionClient) => Promise<unknown>) =>
        operation(transactionClient as unknown as Prisma.TransactionClient),
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PenaltiesService,
        { provide: PrismaService, useValue: mockPrismaService },
        {
          provide: NotificationsService,
          useValue: mockNotificationsService,
        },
      ],
    }).compile();

    service = module.get<PenaltiesService>(PenaltiesService);
  });

  describe('findAllAcrossOrganizations', () => {
    it('returns trust scores with penalties and blacklisted users', async () => {
      await expect(service.findAllAcrossOrganizations()).resolves.toEqual({
        penalties: [],
        blacklistedUsers: [],
      });
      expect(penaltyFindMany).toHaveBeenCalledWith({
        select: {
          id: true,
          reason: true,
          description: true,
          points: true,
          issuedAt: true,
          user: {
            select: {
              id: true,
              email: true,
              fullName: true,
              trustScore: true,
            },
          },
          organization: { select: { id: true, name: true } },
        },
        orderBy: { issuedAt: 'desc' },
      });
      expect(userFindMany).toHaveBeenCalledWith({
        where: { isBlacklisted: true },
        select: {
          id: true,
          email: true,
          fullName: true,
          trustScore: true,
          blacklistReason: true,
        },
      });
    });
  });

  it.each([
    [PenaltyReason.NO_SHOW, 20],
    [PenaltyReason.RULE_VIOLATION, 15],
    [PenaltyReason.CONTRACT_BREACH, 30],
    [PenaltyReason.BAD_REVIEW, 10],
    [PenaltyReason.OTHER, 5],
  ])('uses the default deduction for %s', async (reason, points) => {
    await service.create(bookingId, organizationId, { reason });

    expect(penaltyCreate).toHaveBeenCalledWith({
      data: {
        organizationId,
        userId: vendorUserId,
        bookingId,
        reason,
        points,
        description: undefined,
      },
    });
    expect(userUpdate).toHaveBeenCalledWith({
      where: { id: vendorUserId },
      data: { trustScore: 100 - points },
    });
  });

  it('allows an admin to override the default deduction', async () => {
    bookingFindFirst.mockResolvedValue({
      vendorUserId,
      vendor: { trustScore: 40, isBlacklisted: false },
    });

    await expect(
      service.create(bookingId, organizationId, {
        ...dto,
        points: 35,
      }),
    ).resolves.toMatchObject({
      justBlacklisted: false,
      trustScore: 5,
    });
    expect(penaltyCreate).toHaveBeenCalledWith({
      data: {
        organizationId,
        userId: vendorUserId,
        bookingId,
        reason: dto.reason,
        points: 35,
        description: dto.description,
      },
    });
    expect(userUpdate).toHaveBeenCalledWith({
      where: { id: vendorUserId },
      data: { trustScore: 5 },
    });
  });

  it('clamps trust score at zero and blacklists exactly on transition', async () => {
    bookingFindFirst.mockResolvedValue({
      vendorUserId,
      vendor: { trustScore: 10, isBlacklisted: false },
    });

    await expect(
      service.create(bookingId, organizationId, dto),
    ).resolves.toMatchObject({
      justBlacklisted: true,
      trustScore: 0,
    });
    expect(userUpdate).toHaveBeenCalledWith({
      where: { id: vendorUserId },
      data: {
        trustScore: 0,
        isBlacklisted: true,
        blacklistReason: 'คะแนนความน่าเชื่อถือลดลงเหลือ 0',
      },
    });
  });

  it('does not report a second blacklist transition', async () => {
    bookingFindFirst.mockResolvedValue({
      vendorUserId,
      vendor: { trustScore: 10, isBlacklisted: true },
    });

    await expect(
      service.create(bookingId, organizationId, dto),
    ).resolves.toMatchObject({
      justBlacklisted: false,
      trustScore: 0,
    });
    expect(userUpdate).toHaveBeenCalledWith({
      where: { id: vendorUserId },
      data: { trustScore: 0 },
    });
  });

  it('notifies after the transaction without exposing the description', async () => {
    await service.create(bookingId, organizationId, dto);

    expect(createForUser).toHaveBeenCalledTimes(1);
    const [notifiedUserId, notification] = createForUser.mock.calls[0];
    expect(notifiedUserId).toBe(vendorUserId);
    expect(notification).toMatchObject({
      type: NotificationType.PENALTY,
      title: 'Trust Score ของคุณถูกหัก',
      relatedEntityType: 'PENALTY',
      relatedEntityId: penaltyId,
    });
    expect(notification.body).toContain(
      'เหตุผล: ไม่มาตามนัด · หัก 20 คะแนน · คงเหลือ 80/100',
    );
    expect(notification.body).not.toContain(dto.description);
    expect(prismaTransaction.mock.invocationCallOrder[0]).toBeLessThan(
      createForUser.mock.invocationCallOrder[0],
    );
  });

  describe('createForUser', () => {
    const adminDto: CreateAdminPenaltyDto = {
      organizationId,
      userId: vendorUserId,
      reason: PenaltyReason.OTHER,
      points: 7,
    };

    it('creates a direct Super Admin penalty without a booking', async () => {
      await expect(service.createForUser(adminDto)).resolves.toMatchObject({
        justBlacklisted: false,
        trustScore: 93,
      });
      expect(organizationFindUnique).toHaveBeenCalledWith({
        where: { id: organizationId },
        select: { id: true },
      });
      expect(userFindFirst).toHaveBeenCalledWith({
        where: { id: vendorUserId, role: UserRole.VENDOR },
        select: { trustScore: true, isBlacklisted: true },
      });
      expect(penaltyCreate).toHaveBeenCalledWith({
        data: {
          organizationId,
          userId: vendorUserId,
          bookingId: undefined,
          reason: PenaltyReason.OTHER,
          points: 7,
          description: undefined,
        },
      });
    });

    it('validates an optional booking belongs to both user and organization', async () => {
      bookingFindFirst.mockResolvedValue({ id: bookingId });

      await service.createForUser({ ...adminDto, bookingId });

      expect(bookingFindFirst).toHaveBeenCalledWith({
        where: {
          id: bookingId,
          vendorUserId,
          event: { organizationId },
        },
        select: { id: true },
      });
    });

    it('returns 404 when the organization is missing', async () => {
      organizationFindUnique.mockResolvedValue(null);

      await expect(service.createForUser(adminDto)).rejects.toEqual(
        new NotFoundException('ไม่พบองค์กร'),
      );
      expect(userFindFirst).not.toHaveBeenCalled();
      expect(penaltyCreate).not.toHaveBeenCalled();
    });

    it('returns 404 for a missing or non-vendor user', async () => {
      userFindFirst.mockResolvedValue(null);

      await expect(service.createForUser(adminDto)).rejects.toEqual(
        new NotFoundException('ไม่พบผู้ขาย'),
      );
      expect(penaltyCreate).not.toHaveBeenCalled();
    });

    it('returns 404 when the optional booking does not match', async () => {
      bookingFindFirst.mockResolvedValue(null);

      await expect(
        service.createForUser({ ...adminDto, bookingId }),
      ).rejects.toEqual(new NotFoundException('ไม่พบการจอง'));
      expect(penaltyCreate).not.toHaveBeenCalled();
    });
  });

  it('lists organization history with the authoritative trust state', async () => {
    const penalty: Penalty = {
      id: penaltyId,
      organizationId,
      userId: vendorUserId,
      bookingId,
      reason: PenaltyReason.NO_SHOW,
      description: dto.description ?? null,
      points: 20,
      issuedAt,
      createdAt: issuedAt,
    };
    penaltyFindMany.mockResolvedValue([penalty]);
    bookingFindFirst.mockResolvedValue({
      vendorUserId,
      vendor: { trustScore: 80, isBlacklisted: false },
    });

    await expect(
      service.listForBookingVendor(bookingId, organizationId),
    ).resolves.toEqual({
      penalties: [penalty],
      trustScore: 80,
      isBlacklisted: false,
    });
    expect(penaltyFindMany).toHaveBeenCalledWith({
      where: { organizationId, userId: vendorUserId },
      orderBy: { issuedAt: 'desc' },
    });
  });

  it.each(['create', 'list'] as const)(
    'returns 404 when the booking is missing during %s',
    async (operation) => {
      bookingFindFirst.mockResolvedValue(null);

      const promise =
        operation === 'create'
          ? service.create(bookingId, organizationId, dto)
          : service.listForBookingVendor(bookingId, organizationId);

      await expect(promise).rejects.toBeInstanceOf(NotFoundException);
      expect(penaltyCreate).not.toHaveBeenCalled();
      expect(penaltyFindMany).not.toHaveBeenCalled();
    },
  );

  it('retries a serializable write conflict before saving', async () => {
    const serializationError = new Prisma.PrismaClientKnownRequestError(
      'Transaction write conflict',
      { code: 'P2034', clientVersion: 'test' },
    );
    prismaTransaction
      .mockRejectedValueOnce(serializationError)
      .mockImplementationOnce(
        (operation: (client: Prisma.TransactionClient) => Promise<unknown>) =>
          operation(transactionClient as unknown as Prisma.TransactionClient),
      );

    await expect(
      service.create(bookingId, organizationId, dto),
    ).resolves.toMatchObject({ trustScore: 80 });
    expect(prismaTransaction).toHaveBeenCalledTimes(2);
    expect(penaltyCreate).toHaveBeenCalledTimes(1);
  });

  it('returns a conflict after three serialization failures', async () => {
    const serializationError = new Prisma.PrismaClientKnownRequestError(
      'Transaction write conflict',
      { code: 'P2034', clientVersion: 'test' },
    );
    prismaTransaction.mockRejectedValue(serializationError);

    await expect(
      service.create(bookingId, organizationId, dto),
    ).rejects.toEqual(
      new ConflictException('มีการออกแต้มโทษพร้อมกัน กรุณาลองใหม่อีกครั้ง'),
    );
    expect(prismaTransaction).toHaveBeenCalledTimes(3);
    expect(createForUser).not.toHaveBeenCalled();
  });
});
