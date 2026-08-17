import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PenaltyReason, Prisma, type Penalty } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
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
const penalty: Penalty = {
  id: penaltyId,
  organizationId,
  userId: vendorUserId,
  bookingId,
  reason: dto.reason,
  description: dto.description ?? null,
  points: 1,
  issuedAt,
  createdAt: issuedAt,
};

const bookingFindFirst = jest.fn();
const penaltyCreate = jest.fn();
const penaltyAggregate = jest.fn();
const penaltyFindMany = jest.fn();
const userUpdate = jest.fn();
const prismaTransaction = jest.fn();
const transactionClient = {
  booking: { findFirst: bookingFindFirst },
  penalty: {
    create: penaltyCreate,
    aggregate: penaltyAggregate,
  },
  user: { update: userUpdate },
};
const mockPrismaService = {
  booking: { findFirst: bookingFindFirst },
  penalty: {
    findMany: penaltyFindMany,
    aggregate: penaltyAggregate,
  },
  $transaction: prismaTransaction,
};

describe('PenaltiesService', () => {
  let service: PenaltiesService;

  beforeEach(async () => {
    jest.clearAllMocks();
    bookingFindFirst.mockResolvedValue({
      vendorUserId,
      vendor: { isBlacklisted: false },
    });
    penaltyCreate.mockResolvedValue(penalty);
    penaltyAggregate.mockResolvedValue({ _sum: { points: 1 } });
    penaltyFindMany.mockResolvedValue([penalty]);
    userUpdate.mockResolvedValue({ id: vendorUserId });
    prismaTransaction.mockImplementation(
      (operation: (client: Prisma.TransactionClient) => Promise<unknown>) =>
        operation(transactionClient as unknown as Prisma.TransactionClient),
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PenaltiesService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<PenaltiesService>(PenaltiesService);
  });

  it('creates a penalty below the threshold without blacklisting', async () => {
    penaltyAggregate.mockResolvedValue({ _sum: { points: 2 } });

    await expect(
      service.create(bookingId, organizationId, dto),
    ).resolves.toEqual({
      penalty,
      justBlacklisted: false,
      totalPoints: 2,
    });
    expect(prismaTransaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
    expect(bookingFindFirst).toHaveBeenCalledWith({
      where: { id: bookingId, event: { organizationId } },
      select: {
        vendorUserId: true,
        vendor: { select: { isBlacklisted: true } },
      },
    });
    expect(penaltyCreate).toHaveBeenCalledWith({
      data: {
        organizationId,
        userId: vendorUserId,
        bookingId,
        reason: dto.reason,
        description: dto.description,
      },
    });
    expect(userUpdate).not.toHaveBeenCalled();
  });

  it('marks the vendor when this penalty crosses the threshold', async () => {
    penaltyAggregate.mockResolvedValue({ _sum: { points: 3 } });

    await expect(
      service.create(bookingId, organizationId, dto),
    ).resolves.toEqual({ penalty, justBlacklisted: true, totalPoints: 3 });
    expect(userUpdate).toHaveBeenCalledWith({
      where: { id: vendorUserId },
      data: {
        isBlacklisted: true,
        blacklistReason: 'สะสมแต้มโทษครบ 3 แต้ม (เกณฑ์ 3 แต้ม)',
      },
    });
  });

  it('does not report another transition for an already-blacklisted vendor', async () => {
    bookingFindFirst.mockResolvedValue({
      vendorUserId,
      vendor: { isBlacklisted: true },
    });
    penaltyAggregate.mockResolvedValue({ _sum: { points: 4 } });

    await expect(
      service.create(bookingId, organizationId, dto),
    ).resolves.toEqual({ penalty, justBlacklisted: false, totalPoints: 4 });
    expect(userUpdate).not.toHaveBeenCalled();
  });

  it('repairs a false cache when the global total is already over threshold', async () => {
    penaltyAggregate.mockResolvedValue({ _sum: { points: 4 } });

    await expect(
      service.create(bookingId, organizationId, dto),
    ).resolves.toEqual({ penalty, justBlacklisted: true, totalPoints: 4 });
    expect(userUpdate).toHaveBeenCalledTimes(1);
  });

  it('lists only this organization history but totals every organization', async () => {
    penaltyAggregate.mockResolvedValue({ _sum: { points: 5 } });

    await expect(
      service.listForBookingVendor(bookingId, organizationId),
    ).resolves.toEqual({
      penalties: [penalty],
      totalPointsAllOrgs: 5,
    });
    expect(penaltyFindMany).toHaveBeenCalledWith({
      where: { organizationId, userId: vendorUserId },
      orderBy: { issuedAt: 'desc' },
    });
    expect(penaltyAggregate).toHaveBeenCalledWith({
      where: { userId: vendorUserId },
      _sum: { points: true },
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
    ).resolves.toMatchObject({ penalty });
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
  });
});
