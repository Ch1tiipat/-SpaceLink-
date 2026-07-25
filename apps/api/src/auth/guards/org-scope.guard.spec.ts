import {
  BadRequestException,
  ExecutionContext,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { User, UserRole } from '@prisma/client';
import { OrgScope } from '../../common/decorators/org-scope.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { OrgScopeGuard } from './org-scope.guard';

const ORG_ID = '11111111-1111-4111-8111-111111111111';
const BOOTH_ID = '22222222-2222-4222-8222-222222222222';

/**
 * A real controller carrying real decorators, read back through a real
 * Reflector — so these tests cover @OrgScope as well as the guard.
 */
class TestController {
  // `this: void` is type-only: it says these handlers never touch `this`, so
  // the tests may pass them around detached from the prototype.
  @OrgScope('organizationId')
  byOrganization(this: void) {
    // Route target; the guard only ever reads its metadata.
  }

  @OrgScope('boothId')
  byBooth(this: void) {
    // Route target; the guard only ever reads its metadata.
  }

  unscoped(this: void) {
    // No @OrgScope — the guard must let this through untouched.
  }
}

type RequestStub = {
  params?: Record<string, string>;
  user?: User;
  organizationId?: string;
};

function createContext(
  handler: () => void,
  request: RequestStub,
): ExecutionContext {
  return {
    getHandler: () => handler,
    getClass: () => TestController,
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

function createUser(id: string, role: UserRole): User {
  return { id, role } as User;
}

describe('OrgScopeGuard', () => {
  let prisma: {
    organization: { findUnique: jest.Mock };
    booth: { findUnique: jest.Mock };
    orgMembership: { findUnique: jest.Mock };
  };
  let guard: OrgScopeGuard;

  beforeEach(() => {
    prisma = {
      organization: { findUnique: jest.fn() },
      booth: { findUnique: jest.fn() },
      orgMembership: { findUnique: jest.fn() },
    };
    guard = new OrgScopeGuard(
      new Reflector(),
      prisma as unknown as PrismaService,
    );
  });

  it('lets a handler without @OrgScope through without querying', async () => {
    const request: RequestStub = { params: {}, user: undefined };

    await expect(
      guard.canActivate(
        createContext(TestController.prototype.unscoped, request),
      ),
    ).resolves.toBe(true);

    expect(prisma.organization.findUnique).not.toHaveBeenCalled();
    expect(prisma.orgMembership.findUnique).not.toHaveBeenCalled();
  });

  it('rejects when SupabaseAuthGuard has not run first', async () => {
    const request: RequestStub = { params: { organizationId: ORG_ID } };

    await expect(
      guard.canActivate(
        createContext(TestController.prototype.byOrganization, request),
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects a route param that is not a UUID', async () => {
    const request: RequestStub = {
      params: { organizationId: 'not-a-uuid' },
      user: createUser('user-1', UserRole.ORG_ADMIN),
    };

    await expect(
      guard.canActivate(
        createContext(TestController.prototype.byOrganization, request),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.organization.findUnique).not.toHaveBeenCalled();
  });

  it('lets a SUPER_ADMIN through without a membership query', async () => {
    prisma.organization.findUnique.mockResolvedValue({ id: ORG_ID });
    const request: RequestStub = {
      params: { organizationId: ORG_ID },
      user: createUser('user-1', UserRole.SUPER_ADMIN),
    };

    await expect(
      guard.canActivate(
        createContext(TestController.prototype.byOrganization, request),
      ),
    ).resolves.toBe(true);

    expect(prisma.orgMembership.findUnique).not.toHaveBeenCalled();
    expect(request.organizationId).toBe(ORG_ID);
  });

  it('lets a member through and stores the resolved organization id', async () => {
    prisma.organization.findUnique.mockResolvedValue({ id: ORG_ID });
    prisma.orgMembership.findUnique.mockResolvedValue({ id: 'membership-1' });
    const request: RequestStub = {
      params: { organizationId: ORG_ID },
      user: createUser('user-1', UserRole.ORG_ADMIN),
    };

    await expect(
      guard.canActivate(
        createContext(TestController.prototype.byOrganization, request),
      ),
    ).resolves.toBe(true);

    expect(prisma.orgMembership.findUnique).toHaveBeenCalledWith({
      where: {
        organizationId_userId: { organizationId: ORG_ID, userId: 'user-1' },
      },
      select: { id: true },
    });
    expect(request.organizationId).toBe(ORG_ID);
  });

  // A resource in another organization is indistinguishable from one that does
  // not exist (§14.1) — same status, same message. Only the log tells them apart.
  it('answers 404 for a user who is not a member of the organization', async () => {
    const warn = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    prisma.organization.findUnique.mockResolvedValue({ id: ORG_ID });
    prisma.orgMembership.findUnique.mockResolvedValue(null);
    const request: RequestStub = {
      params: { organizationId: ORG_ID },
      user: createUser('user-1', UserRole.ORG_ADMIN),
    };

    const error: unknown = await guard
      .canActivate(
        createContext(TestController.prototype.byOrganization, request),
      )
      .catch((thrown: unknown) => thrown);

    expect(error).toBeInstanceOf(NotFoundException);
    // Byte-identical to the unknown-resource response below.
    expect((error as NotFoundException).getResponse()).toEqual({
      statusCode: 404,
      message: 'Resource not found',
      error: 'Not Found',
    });
    expect(request.organizationId).toBeUndefined();
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('user-1') as string,
    );
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining(ORG_ID) as string,
    );
    warn.mockRestore();
  });

  it('rejects an unknown organization', async () => {
    prisma.organization.findUnique.mockResolvedValue(null);
    const request: RequestStub = {
      params: { organizationId: ORG_ID },
      user: createUser('user-1', UserRole.ORG_ADMIN),
    };

    await expect(
      guard.canActivate(
        createContext(TestController.prototype.byOrganization, request),
      ),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(prisma.orgMembership.findUnique).not.toHaveBeenCalled();
  });

  it('resolves a booth through zone -> venue -> organization', async () => {
    prisma.booth.findUnique.mockResolvedValue({
      zone: { venue: { organizationId: ORG_ID } },
    });
    prisma.orgMembership.findUnique.mockResolvedValue({ id: 'membership-1' });
    const request: RequestStub = {
      params: { boothId: BOOTH_ID },
      user: createUser('user-1', UserRole.ORG_ADMIN),
    };

    await expect(
      guard.canActivate(
        createContext(TestController.prototype.byBooth, request),
      ),
    ).resolves.toBe(true);

    expect(prisma.booth.findUnique).toHaveBeenCalledWith({
      where: { id: BOOTH_ID },
      select: {
        zone: { select: { venue: { select: { organizationId: true } } } },
      },
    });
    expect(request.organizationId).toBe(ORG_ID);
  });
});
