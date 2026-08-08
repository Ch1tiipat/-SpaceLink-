import { ConflictException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { BoothStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBoothDto } from './dto/create-booth.dto';
import { UpdateBoothDto } from './dto/update-booth.dto';
import { BoothResponse, BoothsService } from './booths.service';

const findMany = jest.fn();
const findUnique = jest.fn();
const create = jest.fn();
const update = jest.fn();
const deleteBooth = jest.fn();
const mockPrismaService = {
  booth: {
    findMany,
    findUnique,
    create,
    update,
    delete: deleteBooth,
  },
};

const zoneId = '00000000-0000-4000-8000-000000000001';
const orgId = '00000000-0000-4000-8000-0000000000a1';
const boothId = '00000000-0000-4000-8000-0000000000b1';
const createdAt = new Date('2026-01-01T00:00:00.000Z');
const updatedAt = new Date('2026-01-02T00:00:00.000Z');

/**
 * The row as `boothSelect` projects it, and the shape the service is expected
 * to map it to. Decimal columns are real `Prisma.Decimal` values here because
 * the whole point of `toResponse` is that they leave as strings (§6.1).
 * `boothPrice` is required in the schema, so it maps to `string`, never null.
 */
const BOOTH_RECORD = {
  id: boothId,
  zoneId,
  code: 'A01',
  boothPrice: new Prisma.Decimal('1500.00'),
  widthM: new Prisma.Decimal('2.50'),
  heightM: null,
  facilities: null,
  posX: new Prisma.Decimal('10.5000'),
  posY: null,
  status: BoothStatus.AVAILABLE,
  createdAt,
  updatedAt,
};

const BOOTH_RESPONSE: BoothResponse = {
  id: boothId,
  zoneId,
  code: 'A01',
  boothPrice: '1500',
  widthM: '2.5',
  heightM: null,
  facilities: null,
  posX: '10.5',
  posY: null,
  status: BoothStatus.AVAILABLE,
  createdAt,
  updatedAt,
};

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
    findMany.mockResolvedValue([BOOTH_RECORD]);

    await expect(service.findAll()).resolves.toEqual([BOOTH_RESPONSE]);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: undefined }),
    );
  });

  it('filters booths by zoneId when provided', async () => {
    findMany.mockResolvedValue([BOOTH_RECORD]);

    await expect(service.findAll({ zoneId })).resolves.toEqual([
      BOOTH_RESPONSE,
    ]);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { zoneId } }),
    );
  });

  it('returns an empty list when zoneId matches no booths', async () => {
    findMany.mockResolvedValue([]);

    await expect(service.findAll({ zoneId })).resolves.toEqual([]);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { zoneId } }),
    );
  });

  it('converts Decimal columns to strings rather than numbers', async () => {
    findMany.mockResolvedValue([BOOTH_RECORD]);

    const [booth] = await service.findAll();

    expect(booth.boothPrice).toBe('1500');
    expect(booth.widthM).toBe('2.5');
    expect(booth.heightM).toBeNull();
  });

  it('maps a found booth through the response shape', async () => {
    findUnique.mockResolvedValue(BOOTH_RECORD);

    await expect(service.findOne(boothId)).resolves.toEqual(BOOTH_RESPONSE);
  });

  // Unchanged behaviour: a public read that misses stays null rather than 404.
  it('returns null when the booth does not exist', async () => {
    findUnique.mockResolvedValue(null);

    await expect(service.findOne(boothId)).resolves.toBeNull();
  });

  it('creates a booth with zoneId from the argument, not the DTO', async () => {
    const dto: CreateBoothDto = { code: 'A01', boothPrice: '1500.00' };
    create.mockResolvedValue(BOOTH_RECORD);

    await expect(service.create(zoneId, dto)).resolves.toEqual(BOOTH_RESPONSE);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { code: 'A01', boothPrice: '1500.00', zoneId },
      }),
    );
  });

  /*
   * These assert the shape of the `where` clause, not that it blocks anything:
   * on this route OrgScopeGuard resolves the organization from the booth being
   * written, so the filter matches by construction and cannot reject a row the
   * guard allowed. What is pinned here is the §14.2 requirement that the query
   * names the org relation explicitly, one level deeper than the zone case —
   * booth -> zone -> venue -> organization.
   */
  it('scopes the update to the caller organization', async () => {
    const dto: UpdateBoothDto = { boothPrice: '2000.00' };
    update.mockResolvedValue(BOOTH_RECORD);

    await expect(service.update(boothId, dto, orgId)).resolves.toEqual(
      BOOTH_RESPONSE,
    );
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: boothId, zone: { venue: { organizationId: orgId } } },
        data: dto,
      }),
    );
  });

  it('scopes the delete to the caller organization', async () => {
    deleteBooth.mockResolvedValue(BOOTH_RECORD);

    await expect(service.remove(boothId, orgId)).resolves.toEqual(
      BOOTH_RESPONSE,
    );
    expect(deleteBooth).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: boothId, zone: { venue: { organizationId: orgId } } },
      }),
    );
  });

  /*
   * Booking.booth is onDelete: Restrict, so a booth with any booking against
   * it is refused by the database. That must read as 409 "still has bookings",
   * not the filter's 400 "related resource does not exist", which says the
   * opposite of what happened.
   */
  it('translates an FK-restrict delete into a Thai conflict', async () => {
    deleteBooth.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError(
        'Foreign key constraint failed',
        { code: 'P2003', clientVersion: 'test' },
      ),
    );

    await expect(service.remove(boothId, orgId)).rejects.toBeInstanceOf(
      ConflictException,
    );
    await expect(service.remove(boothId, orgId)).rejects.toThrow(
      'ไม่สามารถลบบูธนี้ได้เนื่องจากยังมีการจองที่เกี่ยวข้องอยู่',
    );
  });

  /*
   * Pins the narrowness of that catch. P2025 is the cross-tenant and
   * not-found case and must keep reaching PrismaExceptionFilter's 404 —
   * swallowing it here would turn "not yours" into a 409 that confirms the
   * row exists (§14.1).
   */
  it('lets a P2025 from a cross-tenant delete propagate untouched', async () => {
    const notFound = new Prisma.PrismaClientKnownRequestError(
      'An operation failed because it depends on one or more records that were required but not found',
      { code: 'P2025', clientVersion: 'test' },
    );
    deleteBooth.mockRejectedValue(notFound);

    await expect(service.remove(boothId, orgId)).rejects.toBe(notFound);
  });

  it('lets a non-Prisma error propagate untouched', async () => {
    const boom = new Error('connection reset');
    deleteBooth.mockRejectedValue(boom);

    await expect(service.remove(boothId, orgId)).rejects.toBe(boom);
  });
});
