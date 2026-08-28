import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { PrismaService } from '../prisma/prisma.service';
import { PlatformConfigService } from './platform-config.service';

const findFirst = jest.fn();
const update = jest.fn();
const create = jest.fn();
const prisma = {
  platformConfig: { findFirst, update, create },
} as unknown as PrismaService;
const record = jest.fn().mockResolvedValue(undefined);
const auditLogsService = { record } as unknown as AuditLogsService;

describe('PlatformConfigService', () => {
  const service = new PlatformConfigService(prisma, auditLogsService);

  beforeEach(() => jest.clearAllMocks());

  it('returns the frozen schema defaults when no config row exists', async () => {
    findFirst.mockResolvedValue(null);

    await expect(service.findBillingConfig()).resolves.toEqual({
      id: null,
      baseFee: '500',
      perZoneRate: '50',
      perDayRate: '100',
      priceMin: '500',
      priceMax: '15000',
      updatedAt: null,
    });
  });

  it('creates the first config row without converting money to numbers', async () => {
    findFirst.mockResolvedValue(null);
    create.mockImplementation(({ data }) =>
      Promise.resolve({
        id: 'config-1',
        ...data,
        updatedAt: new Date('2026-08-28T00:00:00Z'),
      }),
    );

    const result = await service.updateBillingConfig(
      {
        baseFee: '650.50',
        priceMax: '20000',
      },
      'super-admin-1',
    );

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          baseFee: new Prisma.Decimal('650.50'),
          perZoneRate: new Prisma.Decimal('50'),
          perDayRate: new Prisma.Decimal('100'),
          priceMin: new Prisma.Decimal('500'),
          priceMax: new Prisma.Decimal('20000'),
        },
      }),
    );
    expect(record).toHaveBeenCalledWith({
      actorUserId: 'super-admin-1',
      action: 'PLATFORM_CONFIG_UPDATED',
      targetType: 'PLATFORM_CONFIG',
      targetId: 'config-1',
    });
    expect(result.baseFee).toBe('650.5');
  });

  it('rejects a minimum price above the maximum price', async () => {
    findFirst.mockResolvedValue(null);

    await expect(
      service.updateBillingConfig(
        { priceMin: '2000', priceMax: '1000' },
        'super-admin-1',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(create).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
    expect(record).not.toHaveBeenCalled();
  });
});
