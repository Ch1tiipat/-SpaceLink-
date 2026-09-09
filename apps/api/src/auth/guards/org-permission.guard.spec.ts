import {
  ExecutionContext,
  ForbiddenException,
  InternalServerErrorException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { MembershipRole, UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { OrgPermissionGuard } from './org-permission.guard';

const findUnique = jest.fn();
const findFirst = jest.fn();

function contextFor(request: object): ExecutionContext {
  return {
    getHandler: () => function handler() {},
    getClass: () => class Controller {},
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe('OrgPermissionGuard', () => {
  const reflector = {
    getAllAndOverride: jest.fn(),
  } as unknown as Reflector;
  const prisma = {
    orgMembership: { findFirst, findUnique },
  } as unknown as PrismaService;
  const guard = new OrgPermissionGuard(reflector, prisma);

  beforeEach(() => {
    jest.clearAllMocks();
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue('payments');
  });

  it('bypasses SUPER_ADMIN and OWNER', async () => {
    await expect(
      guard.canActivate(
        contextFor({
          organizationId: 'organization-1',
          user: { id: 'user-1', role: UserRole.SUPER_ADMIN },
        }),
      ),
    ).resolves.toBe(true);

    findUnique.mockResolvedValue({ role: MembershipRole.OWNER });
    await expect(
      guard.canActivate(
        contextFor({
          organizationId: 'organization-1',
          user: { id: 'user-1', role: UserRole.ORG_ADMIN },
        }),
      ),
    ).resolves.toBe(true);
  });

  it('allows an ADMIN only when the delegated flag matches', async () => {
    findUnique.mockResolvedValue({
      role: MembershipRole.ADMIN,
      canManagePayments: true,
      canManageZones: false,
    });
    await expect(
      guard.canActivate(
        contextFor({
          organizationId: 'organization-1',
          user: { id: 'user-1', role: UserRole.ORG_ADMIN },
        }),
      ),
    ).resolves.toBe(true);

    (reflector.getAllAndOverride as jest.Mock).mockReturnValue('zones');
    findFirst.mockResolvedValue({ id: 'owner-membership-1' });
    await expect(
      guard.canActivate(
        contextFor({
          organizationId: 'organization-1',
          user: { id: 'user-1', role: UserRole.ORG_ADMIN },
        }),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('preserves legacy ADMIN access while the organization has no OWNER', async () => {
    findUnique.mockResolvedValue({
      role: MembershipRole.ADMIN,
      canManagePayments: false,
      canManageZones: false,
    });
    findFirst.mockResolvedValue(null);

    await expect(
      guard.canActivate(
        contextFor({
          organizationId: 'organization-1',
          user: { id: 'user-1', role: UserRole.ORG_ADMIN },
        }),
      ),
    ).resolves.toBe(true);
  });

  it('enforces delegated permissions after an OWNER is assigned', async () => {
    findUnique.mockResolvedValue({
      role: MembershipRole.ADMIN,
      canManagePayments: false,
      canManageZones: false,
    });
    findFirst.mockResolvedValue({ id: 'owner-membership-1' });

    await expect(
      guard.canActivate(
        contextFor({
          organizationId: 'organization-1',
          user: { id: 'user-1', role: UserRole.ORG_ADMIN },
        }),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('fails loudly if it is used without the org-scope guard', async () => {
    await expect(
      guard.canActivate(
        contextFor({ user: { id: 'user-1', role: UserRole.ORG_ADMIN } }),
      ),
    ).rejects.toBeInstanceOf(InternalServerErrorException);
  });
});
