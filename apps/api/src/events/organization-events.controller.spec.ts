import { ForbiddenException, Logger, NotFoundException } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
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
import { PrismaService } from '../prisma/prisma.service';
import { EventsService } from './events.service';
import { OrganizationEventsController } from './organization-events.controller';

const ORGANIZATION_ID = '11111111-1111-4111-8111-111111111111';
const ORG_ADMIN_ID = '22222222-2222-4222-8222-222222222222';
const findByOrganization = jest.fn();
const service = { findByOrganization } as unknown as EventsService;

function handler(): object {
  const descriptor = Object.getOwnPropertyDescriptor(
    OrganizationEventsController.prototype,
    'findByOrganization',
  );
  if (!descriptor) {
    throw new Error('Missing controller handler: findByOrganization');
  }
  return descriptor.value as object;
}

function contextFor(request: object): ExecutionContext {
  return {
    getHandler: handler,
    getClass: () => OrganizationEventsController,
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe('OrganizationEventsController', () => {
  const controller = new OrganizationEventsController(service);

  beforeEach(() => jest.clearAllMocks());

  it('uses the full org-scope guard chain for organization admins', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, handler())).toEqual([
      SupabaseAuthGuard,
      OrgScopeGuard,
      RolesGuard,
    ]);
    expect(Reflect.getMetadata(ORG_SCOPE_KEY, handler())).toBe(
      'organizationId',
    );
    expect(Reflect.getMetadata(ROLES_KEY, handler())).toEqual([
      UserRole.SUPER_ADMIN,
      UserRole.ORG_ADMIN,
    ]);
  });

  it('passes only the guard-resolved organization id to the service', async () => {
    findByOrganization.mockResolvedValue([]);

    await controller.findByOrganization(ORGANIZATION_ID);

    expect(findByOrganization).toHaveBeenCalledWith(ORGANIZATION_ID);
  });

  it('answers 404 when an ORG_ADMIN requests another organization', async () => {
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

    await expect(guard.canActivate(contextFor(request))).rejects.toBeInstanceOf(
      NotFoundException,
    );
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
