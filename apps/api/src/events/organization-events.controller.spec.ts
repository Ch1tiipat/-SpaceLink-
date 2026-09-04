import {
  BadRequestException,
  ForbiddenException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { GUARDS_METADATA, ROUTE_ARGS_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';

jest.mock('jose', () => ({
  createRemoteJWKSet: jest.fn(),
  jwtVerify: jest.fn(),
}));

import { OrgStatus, UserRole, type User } from '@prisma/client';
import type { ExecutionContext } from '@nestjs/common';
import { OrgScopeGuard } from '../auth/guards/org-scope.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { SupabaseAuthGuard } from '../auth/guards/supabase-auth.guard';
import { ORG_SCOPE_KEY } from '../common/decorators/org-scope.decorator';
import { ROLES_KEY } from '../common/decorators/roles.decorator';
import { LooseUuidPipe } from '../common/pipes/loose-uuid.pipe';
import { PrismaService } from '../prisma/prisma.service';
import { EventsService } from './events.service';
import { OrganizationEventsController } from './organization-events.controller';

const ORGANIZATION_ID = '11111111-1111-4111-8111-111111111111';
const LEGACY_EVENT_ID = '44444444-4444-4444-4444-444444444444';
const ORG_ADMIN_ID = '22222222-2222-4222-8222-222222222222';
const findByOrganization = jest.fn();
const create = jest.fn();
const quoteSubscription = jest.fn();
const publish = jest.fn();
const open = jest.fn();
const close = jest.fn();
const remove = jest.fn();
const update = jest.fn();
const service = {
  findByOrganization,
  create,
  quoteSubscription,
  publish,
  open,
  close,
  remove,
  update,
} as unknown as EventsService;

function handler(
  name:
    | 'findByOrganization'
    | 'create'
    | 'quoteSubscription'
    | 'publish'
    | 'open'
    | 'close'
    | 'update'
    | 'remove' = 'findByOrganization',
): object {
  const descriptor = Object.getOwnPropertyDescriptor(
    OrganizationEventsController.prototype,
    name,
  );
  if (!descriptor?.value) {
    throw new Error(`Missing controller handler: ${name}`);
  }
  return descriptor.value as object;
}

function contextFor(
  request: object,
  name: Parameters<typeof handler>[0] = 'findByOrganization',
): ExecutionContext {
  return {
    getHandler: () => handler(name),
    getClass: () => OrganizationEventsController,
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe('OrganizationEventsController', () => {
  const controller = new OrganizationEventsController(service);

  beforeEach(() => jest.clearAllMocks());

  it('uses the full org-scope guard chain for organization admins', () => {
    for (const name of [
      'findByOrganization',
      'create',
      'quoteSubscription',
      'publish',
      'open',
      'close',
      'remove',
      'update',
    ] as const) {
      expect(Reflect.getMetadata(GUARDS_METADATA, handler(name))).toEqual([
        SupabaseAuthGuard,
        OrgScopeGuard,
        RolesGuard,
      ]);
      expect(Reflect.getMetadata(ORG_SCOPE_KEY, handler(name))).toBe(
        'organizationId',
      );
      expect(Reflect.getMetadata(ROLES_KEY, handler(name))).toEqual([
        UserRole.SUPER_ADMIN,
        UserRole.ORG_ADMIN,
      ]);
    }
  });

  it('uses only the guard-resolved organization id for quotes and creates', async () => {
    const input = {
      venueId: '33333333-3333-4333-8333-333333333333',
      name: 'Market',
      startDate: '2026-09-01',
      endDate: '2026-09-01',
    };
    quoteSubscription.mockResolvedValue({ finalPrice: '750' });
    create.mockResolvedValue({ id: 'event-1' });

    await controller.quoteSubscription(ORGANIZATION_ID, input);
    await controller.create(ORGANIZATION_ID, input);

    expect(quoteSubscription).toHaveBeenCalledWith(input, ORGANIZATION_ID);
    expect(create).toHaveBeenCalledWith(input, ORGANIZATION_ID);
  });

  it('passes only the guard-resolved organization id to the service', async () => {
    findByOrganization.mockResolvedValue([]);

    await controller.findByOrganization(ORGANIZATION_ID);

    expect(findByOrganization).toHaveBeenCalledWith(ORGANIZATION_ID);
  });

  it('publishes only within the guard-resolved organization', async () => {
    publish.mockResolvedValue({ id: 'event-1', status: 'PUBLISHED' });

    await controller.publish(ORGANIZATION_ID, 'event-1');

    expect(publish).toHaveBeenCalledWith('event-1', ORGANIZATION_ID);
  });

  it('opens, closes, and deletes only within the guard-resolved organization', async () => {
    open.mockResolvedValue({ id: 'event-1', status: 'PUBLISHED' });
    close.mockResolvedValue({ id: 'event-1', status: 'CANCELLED' });
    remove.mockResolvedValue({ id: 'event-1' });

    await controller.open(ORGANIZATION_ID, 'event-1');
    await controller.close(ORGANIZATION_ID, 'event-1');
    await controller.remove(ORGANIZATION_ID, 'event-1');

    expect(open).toHaveBeenCalledWith('event-1', ORGANIZATION_ID);
    expect(close).toHaveBeenCalledWith('event-1', ORGANIZATION_ID);
    expect(remove).toHaveBeenCalledWith('event-1', ORGANIZATION_ID);
  });

  it.each(['publish', 'open', 'close', 'remove', 'update'] as const)(
    'validates the %s event id by UUID shape',
    (method) => {
      const metadata = Reflect.getMetadata(
        ROUTE_ARGS_METADATA,
        OrganizationEventsController,
        method,
      ) as Record<string, { data?: string; pipes?: unknown[] }>;
      const eventIdParameter = Object.values(metadata).find(
        (parameter) => parameter.data === 'eventId',
      );

      expect(eventIdParameter?.pipes).toEqual(
        expect.arrayContaining([expect.any(LooseUuidPipe)]),
      );

      const pipe = eventIdParameter?.pipes?.find(
        (candidate) => candidate instanceof LooseUuidPipe,
      ) as LooseUuidPipe;
      expect(pipe.transform(LEGACY_EVENT_ID)).toBe(LEGACY_EVENT_ID);
      expect(() => pipe.transform('not-a-uuid')).toThrow(BadRequestException);
    },
  );

  it.each(['findByOrganization', 'update'] as const)(
    'answers 404 when an ORG_ADMIN requests another organization via %s',
    async (name) => {
      const warn = jest
        .spyOn(Logger.prototype, 'warn')
        .mockImplementation(() => undefined);
      const prisma = {
        organization: {
          findUnique: jest.fn().mockResolvedValue({ id: ORGANIZATION_ID }),
        },
        orgMembership: { findUnique: jest.fn().mockResolvedValue(null) },
      };
      const guard = new OrgScopeGuard(
        new Reflector(),
        prisma as unknown as PrismaService,
      );
      const request = {
        params: { organizationId: ORGANIZATION_ID },
        user: { id: ORG_ADMIN_ID, role: UserRole.ORG_ADMIN } as User,
      };

      await expect(
        guard.canActivate(contextFor(request, name)),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.orgMembership.findUnique).toHaveBeenCalledWith({
        where: {
          organizationId_userId: {
            organizationId: ORGANIZATION_ID,
            userId: ORG_ADMIN_ID,
          },
        },
        select: { id: true },
      });
      warn.mockRestore();
    },
  );

  it.each([UserRole.ORG_ADMIN, UserRole.SUPER_ADMIN])(
    'allows %s to update with the guard-resolved organization',
    async (role) => {
      const request = {
        params: { organizationId: ORGANIZATION_ID },
        user: { id: ORG_ADMIN_ID, role } as User,
      };
      const prisma = {
        organization: {
          findUnique: jest.fn().mockResolvedValue({
            id: ORGANIZATION_ID,
            status: OrgStatus.ACTIVE,
          }),
        },
        orgMembership: {
          findUnique: jest.fn().mockResolvedValue({ id: 'membership' }),
        },
      };
      const context = contextFor(request, 'update');
      const guard = new OrgScopeGuard(
        new Reflector(),
        prisma as unknown as PrismaService,
      );
      expect(await guard.canActivate(context)).toBe(true);
      expect(new RolesGuard(new Reflector()).canActivate(context)).toBe(true);
      const input = { name: 'ชื่องานใหม่' };
      const result = { id: LEGACY_EVENT_ID, ...input };
      update.mockResolvedValue(result);
      await expect(
        controller.update(ORGANIZATION_ID, LEGACY_EVENT_ID, input),
      ).resolves.toEqual(result);
      expect(update).toHaveBeenCalledWith(
        LEGACY_EVENT_ID,
        input,
        ORGANIZATION_ID,
      );
    },
  );

  it('rejects vendors on the update handler', () => {
    const context = contextFor(
      { user: { id: ORG_ADMIN_ID, role: UserRole.VENDOR } },
      'update',
    );
    expect(() => new RolesGuard(new Reflector()).canActivate(context)).toThrow(
      ForbiddenException,
    );
    expect(update).not.toHaveBeenCalled();
  });

  it('answers 403 when an ORG_ADMIN organization is suspended', async () => {
    const prisma = {
      organization: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce({ id: ORGANIZATION_ID })
          .mockResolvedValueOnce({ status: OrgStatus.SUSPENDED }),
      },
      orgMembership: {
        findUnique: jest.fn().mockResolvedValue({ id: 'membership-1' }),
      },
    };
    const guard = new OrgScopeGuard(
      new Reflector(),
      prisma as unknown as PrismaService,
    );
    const request = {
      params: { organizationId: ORGANIZATION_ID },
      user: { id: ORG_ADMIN_ID, role: UserRole.ORG_ADMIN } as User,
    };

    await expect(guard.canActivate(contextFor(request))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});
