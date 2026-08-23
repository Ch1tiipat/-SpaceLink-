import {
  BadRequestException,
  ExecutionContext,
  ForbiddenException,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { OrgStatus, User, UserRole } from '@prisma/client';
import { OrgScope } from '../../common/decorators/org-scope.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { OrgScopeGuard } from './org-scope.guard';

const ORG_ID = '11111111-1111-4111-8111-111111111111';
const BOOTH_ID = '22222222-2222-4222-8222-222222222222';
const VENUE_ID = '33333333-3333-4333-8333-333333333333';
const EVENT_ID = '44444444-4444-4444-8444-444444444444';
const ZONE_ID = '55555555-5555-4555-8555-555555555555';
const BOOKING_ID = '66666666-6666-4666-8666-666666666666';
const TICKET_ID = '77777777-7777-4777-8777-777777777777';

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

  @OrgScope('venueId')
  byVenue(this: void) {
    // Route target; the guard only ever reads its metadata.
  }

  @OrgScope('eventId')
  byEvent(this: void) {
    // Route target; the guard only ever reads its metadata.
  }

  @OrgScope('zoneId')
  byZone(this: void) {
    // Route target; the guard only ever reads its metadata.
  }

  @OrgScope('boothId')
  byBooth(this: void) {
    // Route target; the guard only ever reads its metadata.
  }

  @OrgScope('bookingId')
  byBooking(this: void) {
    // Route target; the guard only ever reads its metadata.
  }

  @OrgScope('ticketId')
  byTicket(this: void) {
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
    venue: { findUnique: jest.Mock };
    event: { findUnique: jest.Mock };
    zone: { findUnique: jest.Mock };
    booth: { findUnique: jest.Mock };
    booking: { findUnique: jest.Mock };
    supportTicket: { findUnique: jest.Mock };
    orgMembership: { findUnique: jest.Mock };
  };
  let guard: OrgScopeGuard;

  beforeEach(() => {
    prisma = {
      organization: { findUnique: jest.fn() },
      venue: { findUnique: jest.fn() },
      event: { findUnique: jest.fn() },
      zone: { findUnique: jest.fn() },
      booth: { findUnique: jest.fn() },
      booking: { findUnique: jest.fn() },
      supportTicket: { findUnique: jest.fn() },
      orgMembership: { findUnique: jest.fn() },
    };
    prisma.organization.findUnique.mockResolvedValue({
      status: OrgStatus.ACTIVE,
    });
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
    prisma.organization.findUnique.mockResolvedValue({
      id: ORG_ID,
      status: OrgStatus.ACTIVE,
    });
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

  it('lets a SUPER_ADMIN through even when the organization is suspended', async () => {
    prisma.organization.findUnique.mockResolvedValueOnce({
      id: ORG_ID,
      status: OrgStatus.SUSPENDED,
    });
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
    expect(prisma.organization.findUnique).toHaveBeenCalledTimes(1);
    expect(request.organizationId).toBe(ORG_ID);
  });

  it('blocks a non-SUPER_ADMIN when the organization is suspended', async () => {
    prisma.organization.findUnique.mockResolvedValue({
      id: ORG_ID,
      status: OrgStatus.SUSPENDED,
    });
    prisma.orgMembership.findUnique.mockResolvedValue({ id: 'membership-1' });
    const request: RequestStub = {
      params: { organizationId: ORG_ID },
      user: createUser('user-1', UserRole.ORG_ADMIN),
    };

    await expect(
      guard.canActivate(
        createContext(TestController.prototype.byOrganization, request),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(request.organizationId).toBeUndefined();
  });

  it('blocks a non-SUPER_ADMIN when the organization is inactive', async () => {
    prisma.organization.findUnique.mockResolvedValue({
      id: ORG_ID,
      status: OrgStatus.INACTIVE,
    });
    prisma.orgMembership.findUnique.mockResolvedValue({ id: 'membership-1' });
    const request: RequestStub = {
      params: { organizationId: ORG_ID },
      user: createUser('user-1', UserRole.ORG_ADMIN),
    };

    await expect(
      guard.canActivate(
        createContext(TestController.prototype.byOrganization, request),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(request.organizationId).toBeUndefined();
  });

  it('checks membership before organization status', async () => {
    const warn = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    prisma.organization.findUnique.mockResolvedValue({
      id: ORG_ID,
      status: OrgStatus.SUSPENDED,
    });
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
    expect(error).not.toBeInstanceOf(ForbiddenException);
    expect(prisma.organization.findUnique).toHaveBeenCalledTimes(1);
    expect(request.organizationId).toBeUndefined();
    warn.mockRestore();
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

  it('resolves a venue by reading its own organizationId', async () => {
    prisma.venue.findUnique.mockResolvedValue({ organizationId: ORG_ID });
    prisma.orgMembership.findUnique.mockResolvedValue({ id: 'membership-1' });
    const request: RequestStub = {
      params: { venueId: VENUE_ID },
      user: createUser('user-1', UserRole.ORG_ADMIN),
    };

    await expect(
      guard.canActivate(
        createContext(TestController.prototype.byVenue, request),
      ),
    ).resolves.toBe(true);

    // One query, on `venue`, selecting nothing but the id needed to continue —
    // a wider select would pull a whole row through a guard that only decides.
    expect(prisma.venue.findUnique).toHaveBeenCalledWith({
      where: { id: VENUE_ID },
      select: { organizationId: true },
    });
    expect(prisma.venue.findUnique).toHaveBeenCalledTimes(1);
    expect(request.organizationId).toBe(ORG_ID);
  });

  // The path SCRUM-19 puts on nearly every route, hence the fullest coverage:
  // the query shape, the membership check built from its result, and both 404s.
  it('resolves an event by reading its own organizationId', async () => {
    prisma.event.findUnique.mockResolvedValue({ organizationId: ORG_ID });
    prisma.orgMembership.findUnique.mockResolvedValue({ id: 'membership-1' });
    const request: RequestStub = {
      params: { eventId: EVENT_ID },
      user: createUser('user-1', UserRole.ORG_ADMIN),
    };

    await expect(
      guard.canActivate(
        createContext(TestController.prototype.byEvent, request),
      ),
    ).resolves.toBe(true);

    expect(prisma.event.findUnique).toHaveBeenCalledWith({
      where: { id: EVENT_ID },
      select: { organizationId: true },
    });
    expect(prisma.event.findUnique).toHaveBeenCalledTimes(1);
    // An event carries its own organizationId, so nothing else is walked.
    expect(prisma.venue.findUnique).not.toHaveBeenCalled();
    // The membership is checked against the *resolved* org, never against a
    // route param (§14.2) — the request only ever named an event.
    expect(prisma.orgMembership.findUnique).toHaveBeenCalledWith({
      where: {
        organizationId_userId: { organizationId: ORG_ID, userId: 'user-1' },
      },
      select: { id: true },
    });
    expect(request.organizationId).toBe(ORG_ID);
  });

  it('answers 404 for an event owned by another organization', async () => {
    const warn = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    prisma.event.findUnique.mockResolvedValue({ organizationId: ORG_ID });
    prisma.orgMembership.findUnique.mockResolvedValue(null);
    const request: RequestStub = {
      params: { eventId: EVENT_ID },
      user: createUser('user-1', UserRole.ORG_ADMIN),
    };

    const error: unknown = await guard
      .canActivate(createContext(TestController.prototype.byEvent, request))
      .catch((thrown: unknown) => thrown);

    expect(error).toBeInstanceOf(NotFoundException);
    // Byte-identical to the unknown-event response below: a foreign event and a
    // non-existent one must be indistinguishable to the caller (§14.1).
    expect((error as NotFoundException).getResponse()).toEqual({
      statusCode: 404,
      message: 'Resource not found',
      error: 'Not Found',
    });
    expect(request.organizationId).toBeUndefined();
    warn.mockRestore();
  });

  it('rejects an unknown event before checking membership', async () => {
    prisma.event.findUnique.mockResolvedValue(null);
    const request: RequestStub = {
      params: { eventId: EVENT_ID },
      user: createUser('user-1', UserRole.ORG_ADMIN),
    };

    await expect(
      guard.canActivate(
        createContext(TestController.prototype.byEvent, request),
      ),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(prisma.orgMembership.findUnique).not.toHaveBeenCalled();
  });

  it('resolves a zone through venue -> organization', async () => {
    prisma.zone.findUnique.mockResolvedValue({
      venue: { organizationId: ORG_ID },
    });
    prisma.orgMembership.findUnique.mockResolvedValue({ id: 'membership-1' });
    const request: RequestStub = {
      params: { zoneId: ZONE_ID },
      user: createUser('user-1', UserRole.ORG_ADMIN),
    };

    await expect(
      guard.canActivate(
        createContext(TestController.prototype.byZone, request),
      ),
    ).resolves.toBe(true);

    // A zone has no organizationId of its own; the chain is walked inside the
    // single query rather than with a second round trip.
    expect(prisma.zone.findUnique).toHaveBeenCalledWith({
      where: { id: ZONE_ID },
      select: { venue: { select: { organizationId: true } } },
    });
    expect(prisma.zone.findUnique).toHaveBeenCalledTimes(1);
    expect(prisma.venue.findUnique).not.toHaveBeenCalled();
    expect(request.organizationId).toBe(ORG_ID);
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

  it('resolves a booking through event -> organization', async () => {
    prisma.booking.findUnique.mockResolvedValue({
      event: { organizationId: ORG_ID },
    });
    prisma.orgMembership.findUnique.mockResolvedValue({ id: 'membership-1' });
    const request: RequestStub = {
      params: { bookingId: BOOKING_ID },
      user: createUser('user-1', UserRole.ORG_ADMIN),
    };

    await expect(
      guard.canActivate(
        createContext(TestController.prototype.byBooking, request),
      ),
    ).resolves.toBe(true);

    // Event carries organizationId directly, so the chain is one hop and does
    // not fall back to a second query against `event`.
    expect(prisma.booking.findUnique).toHaveBeenCalledWith({
      where: { id: BOOKING_ID },
      select: { event: { select: { organizationId: true } } },
    });
    expect(prisma.booking.findUnique).toHaveBeenCalledTimes(1);
    expect(prisma.event.findUnique).not.toHaveBeenCalled();
    expect(request.organizationId).toBe(ORG_ID);
  });

  it('answers 404 for a booking owned by another organization', async () => {
    const warn = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    prisma.booking.findUnique.mockResolvedValue({
      event: { organizationId: ORG_ID },
    });
    prisma.orgMembership.findUnique.mockResolvedValue(null);
    const request: RequestStub = {
      params: { bookingId: BOOKING_ID },
      user: createUser('user-1', UserRole.ORG_ADMIN),
    };

    const error: unknown = await guard
      .canActivate(createContext(TestController.prototype.byBooking, request))
      .catch((thrown: unknown) => thrown);

    expect(error).toBeInstanceOf(NotFoundException);
    // Byte-identical to the unknown-booking response below (§14.1).
    expect((error as NotFoundException).getResponse()).toEqual({
      statusCode: 404,
      message: 'Resource not found',
      error: 'Not Found',
    });
    expect(request.organizationId).toBeUndefined();
    warn.mockRestore();
  });

  it('rejects an unknown booking before checking membership', async () => {
    prisma.booking.findUnique.mockResolvedValue(null);
    const request: RequestStub = {
      params: { bookingId: BOOKING_ID },
      user: createUser('user-1', UserRole.ORG_ADMIN),
    };

    await expect(
      guard.canActivate(
        createContext(TestController.prototype.byBooking, request),
      ),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(prisma.orgMembership.findUnique).not.toHaveBeenCalled();
  });

  it('resolves a support ticket by reading its own organizationId', async () => {
    prisma.supportTicket.findUnique.mockResolvedValue({
      organizationId: ORG_ID,
    });
    prisma.orgMembership.findUnique.mockResolvedValue({ id: 'membership-1' });
    const request: RequestStub = {
      params: { ticketId: TICKET_ID },
      user: createUser('user-1', UserRole.ORG_ADMIN),
    };

    await expect(
      guard.canActivate(
        createContext(TestController.prototype.byTicket, request),
      ),
    ).resolves.toBe(true);

    // A ticket carries organizationId directly, like an event — nothing else
    // is walked to reach it.
    expect(prisma.supportTicket.findUnique).toHaveBeenCalledWith({
      where: { id: TICKET_ID },
      select: { organizationId: true },
    });
    expect(prisma.supportTicket.findUnique).toHaveBeenCalledTimes(1);
    expect(request.organizationId).toBe(ORG_ID);
  });

  // The one org-scope param whose column is nullable. A ticket belonging to no
  // organization cannot be reached from an org-scoped route, and says so with
  // the same 404 as an unknown id rather than passing `null` down to a query.
  it('answers 404 for a ticket with no organization', async () => {
    prisma.supportTicket.findUnique.mockResolvedValue({
      organizationId: null,
    });
    const request: RequestStub = {
      params: { ticketId: TICKET_ID },
      user: createUser('user-1', UserRole.ORG_ADMIN),
    };

    await expect(
      guard.canActivate(
        createContext(TestController.prototype.byTicket, request),
      ),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(prisma.orgMembership.findUnique).not.toHaveBeenCalled();
    expect(request.organizationId).toBeUndefined();
  });

  it('rejects an unknown support ticket before checking membership', async () => {
    prisma.supportTicket.findUnique.mockResolvedValue(null);
    const request: RequestStub = {
      params: { ticketId: TICKET_ID },
      user: createUser('user-1', UserRole.ORG_ADMIN),
    };

    await expect(
      guard.canActivate(
        createContext(TestController.prototype.byTicket, request),
      ),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(prisma.orgMembership.findUnique).not.toHaveBeenCalled();
  });
});
