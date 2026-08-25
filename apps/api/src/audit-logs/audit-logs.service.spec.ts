import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogsService } from './audit-logs.service';

const auditLogCreate = jest.fn();
const auditLogFindMany = jest.fn();
const mockPrismaService = {
  auditLog: { create: auditLogCreate, findMany: auditLogFindMany },
};

describe('AuditLogsService', () => {
  let service: AuditLogsService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditLogsService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<AuditLogsService>(AuditLogsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('record', () => {
    it('writes the audit row with the given fields', async () => {
      auditLogCreate.mockResolvedValue({});

      await service.record({
        actorUserId: 'actor-1',
        action: 'ORGANIZATION_CREATED',
        targetType: 'ORGANIZATION',
        targetId: 'org-1',
        metadata: { foo: 'bar' },
      });

      expect(auditLogCreate).toHaveBeenCalledWith({
        data: {
          actorUserId: 'actor-1',
          action: 'ORGANIZATION_CREATED',
          targetType: 'ORGANIZATION',
          targetId: 'org-1',
          metadata: { foo: 'bar' },
        },
      });
    });

    it('never throws when the write fails', async () => {
      auditLogCreate.mockRejectedValue(new Error('db down'));

      await expect(
        service.record({
          actorUserId: 'actor-1',
          action: 'ORGANIZATION_CREATED',
          targetType: 'ORGANIZATION',
          targetId: 'org-1',
        }),
      ).resolves.toBeUndefined();
    });
  });

  describe('findAll', () => {
    it('applies no filter when none is given', async () => {
      auditLogFindMany.mockResolvedValue([]);

      await service.findAll({});

      expect(auditLogFindMany).toHaveBeenCalledWith({
        where: {},
        select: {
          id: true,
          action: true,
          targetType: true,
          targetId: true,
          metadata: true,
          createdAt: true,
          actor: { select: { id: true, email: true, fullName: true } },
        },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('filters by action and actorUserId when both are given', async () => {
      auditLogFindMany.mockResolvedValue([]);

      await service.findAll({
        action: 'ORGANIZATION_CREATED',
        actorUserId: 'actor-1',
      });

      expect(auditLogFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            action: 'ORGANIZATION_CREATED',
            actorUserId: 'actor-1',
          },
        }),
      );
    });
  });

  describe('findAllForActor', () => {
    it('filters strictly by actorUserId, never by target', async () => {
      auditLogFindMany.mockResolvedValue([]);

      await service.findAllForActor('actor-1');

      expect(auditLogFindMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { actorUserId: 'actor-1' } }),
      );
    });
  });
});
