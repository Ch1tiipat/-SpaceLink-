import { GUARDS_METADATA } from '@nestjs/common/constants';

jest.mock('jose', () => ({
  createRemoteJWKSet: jest.fn(),
  jwtVerify: jest.fn(),
}));

import { UserRole, type User } from '@prisma/client';
import { OrgScopeGuard } from '../auth/guards/org-scope.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { SupabaseAuthGuard } from '../auth/guards/supabase-auth.guard';
import { ORG_SCOPE_KEY } from '../common/decorators/org-scope.decorator';
import { ROLES_KEY } from '../common/decorators/roles.decorator';
import { RefundsController } from './refunds.controller';
import { RefundsService } from './refunds.service';

type HandlerName =
  | 'create'
  | 'findMine'
  | 'findForOrganization'
  | 'approve'
  | 'reject'
  | 'process';

function handlerOf(name: HandlerName): object {
  return (RefundsController.prototype as unknown as Record<string, object>)[
    name
  ];
}

const VENDOR_ID = '11111111-1111-4111-8111-111111111111';
const ADMIN_ID = '22222222-2222-4222-8222-222222222222';
const BOOKING_ID = '33333333-3333-4333-8333-333333333333';
const REFUND_ID = '44444444-4444-4444-8444-444444444444';
const ORGANIZATION_ID = '55555555-5555-4555-8555-555555555555';

const baseUser = {
  authUserId: '66666666-6666-4666-8666-666666666666',
  email: 'user@example.com',
  fullName: 'User',
  phone: null,
  isBlacklisted: false,
  blacklistReason: null,
  createdAt: new Date('2026-08-01T00:00:00.000Z'),
  updatedAt: new Date('2026-08-01T00:00:00.000Z'),
};
const vendor = {
  ...baseUser,
  id: VENDOR_ID,
  role: UserRole.VENDOR,
} satisfies User;
const admin = {
  ...baseUser,
  id: ADMIN_ID,
  role: UserRole.ORG_ADMIN,
} satisfies User;

describe('RefundsController', () => {
  const create = jest.fn();
  const findMine = jest.fn();
  const findForOrganization = jest.fn();
  const approve = jest.fn();
  const reject = jest.fn();
  const process = jest.fn();
  const service = {
    create,
    findMine,
    findForOrganization,
    approve,
    reject,
    process,
  } as unknown as RefundsService;
  const controller = new RefundsController(service);

  beforeEach(() => jest.clearAllMocks());

  it('authenticates before applying the default role', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, RefundsController)).toEqual([
      SupabaseAuthGuard,
      RolesGuard,
    ]);
    expect(Reflect.getMetadata(ROLES_KEY, RefundsController)).toEqual([
      UserRole.SUPER_ADMIN,
    ]);
  });

  it.each(['create', 'findMine'] as const)(
    'keeps %s vendor-only and derives ownership from the user',
    (handlerName) => {
      const handler = handlerOf(handlerName);
      expect(Reflect.getMetadata(ROLES_KEY, handler)).toEqual([
        UserRole.VENDOR,
      ]);
      expect(Reflect.getMetadata(ORG_SCOPE_KEY, handler)).toBeUndefined();
    },
  );

  it('scopes the admin queue to the guard-resolved organization', () => {
    const handler = handlerOf('findForOrganization');
    expect(Reflect.getMetadata(ROLES_KEY, handler)).toEqual([
      UserRole.SUPER_ADMIN,
      UserRole.ORG_ADMIN,
    ]);
    expect(Reflect.getMetadata(ORG_SCOPE_KEY, handler)).toBe('organizationId');
    expect(Reflect.getMetadata(GUARDS_METADATA, handler)).toEqual([
      SupabaseAuthGuard,
      OrgScopeGuard,
    ]);
  });

  it.each(['approve', 'reject', 'process'] as const)(
    'scopes %s through the booking ownership chain',
    (handlerName) => {
      const handler = handlerOf(handlerName);
      expect(Reflect.getMetadata(ROLES_KEY, handler)).toEqual([
        UserRole.SUPER_ADMIN,
        UserRole.ORG_ADMIN,
      ]);
      expect(Reflect.getMetadata(ORG_SCOPE_KEY, handler)).toBe('bookingId');
      expect(Reflect.getMetadata(GUARDS_METADATA, handler)).toEqual([
        SupabaseAuthGuard,
        OrgScopeGuard,
      ]);
    },
  );

  it('passes the authenticated vendor when creating and listing', async () => {
    const dto = { reason: 'ยกเลิกก่อนวันงาน', requestedAmount: '1500' };

    await controller.create(BOOKING_ID, dto, vendor);
    await controller.findMine(vendor);

    expect(create).toHaveBeenCalledWith(BOOKING_ID, VENDOR_ID, dto);
    expect(findMine).toHaveBeenCalledWith(VENDOR_ID);
  });

  it('passes only the guard-resolved organization to the admin queue', async () => {
    await controller.findForOrganization(ORGANIZATION_ID);
    expect(findForOrganization).toHaveBeenCalledWith(ORGANIZATION_ID);
  });

  it('passes guarded ids and the authenticated reviewer when approving', async () => {
    const dto = { approvedAmount: '1200' };

    await controller.approve(
      BOOKING_ID,
      REFUND_ID,
      dto,
      ORGANIZATION_ID,
      admin,
    );

    expect(approve).toHaveBeenCalledWith(
      BOOKING_ID,
      REFUND_ID,
      ORGANIZATION_ID,
      ADMIN_ID,
      dto,
    );
  });

  it('passes the reviewer for rejection and no invented processor field', async () => {
    await controller.reject(BOOKING_ID, REFUND_ID, ORGANIZATION_ID, admin);
    await controller.process(BOOKING_ID, REFUND_ID, ORGANIZATION_ID);

    expect(reject).toHaveBeenCalledWith(
      BOOKING_ID,
      REFUND_ID,
      ORGANIZATION_ID,
      ADMIN_ID,
    );
    expect(process).toHaveBeenCalledWith(
      BOOKING_ID,
      REFUND_ID,
      ORGANIZATION_ID,
    );
  });
});
