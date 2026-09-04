import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
import { Prisma, VenueStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { VenuesService } from './venues.service';

const findMany = jest.fn();
const create = jest.fn();
const update = jest.fn();
const remove = jest.fn();
const mockPrismaService = {
  venue: {
    findMany,
    create,
    update,
    delete: remove,
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

  it('creates a draft with the trusted organization', async () => {
    create.mockResolvedValue({ ...venues[0], status: VenueStatus.DRAFT });
    await service.create({ name: 'ตลาดใหม่' }, organizationId);
    expect(create).toHaveBeenCalledWith({
      data: { name: 'ตลาดใหม่', organizationId, status: VenueStatus.DRAFT },
    });
  });

  it('archives only within the trusted organization', async () => {
    const result = { ...venues[0], status: VenueStatus.ARCHIVED };
    update.mockResolvedValue(result);
    await expect(
      service.update(
        'venue-1',
        { status: VenueStatus.ARCHIVED },
        organizationId,
      ),
    ).resolves.toEqual(result);
    expect(update).toHaveBeenCalledWith({
      where: { id: 'venue-1', organizationId },
      data: { status: VenueStatus.ARCHIVED },
    });
  });

  it('deletes only within the trusted organization', async () => {
    remove.mockResolvedValue(venues[0]);
    await expect(service.remove('venue-1', organizationId)).resolves.toEqual(
      venues[0],
    );
    expect(remove).toHaveBeenCalledWith({
      where: { id: 'venue-1', organizationId },
    });
  });

  it.each(['P2003', 'P2014'])(
    'translates booking-history restrict error %s into Thai conflict',
    async (code) => {
      remove.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('Restricted', {
          code,
          clientVersion: '6',
        }),
      );
      await expect(service.remove('venue-1', organizationId)).rejects.toThrow(
        new ConflictException(
          'ไม่สามารถลบสถานที่นี้ได้เนื่องจากยังมีโซนหรือการจองที่เกี่ยวข้องอยู่',
        ),
      );
    },
  );

  it('preserves P2025 for the existing 404 exception filter', async () => {
    const error = new Prisma.PrismaClientKnownRequestError('Missing', {
      code: 'P2025',
      clientVersion: '6',
    });
    remove.mockRejectedValue(error);
    update.mockRejectedValue(error);
    await expect(service.remove('venue-1', organizationId)).rejects.toBe(error);
    await expect(service.update('venue-1', {}, organizationId)).rejects.toBe(
      error,
    );
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
