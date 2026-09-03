import { GUARDS_METADATA } from '@nestjs/common/constants';

jest.mock('jose', () => ({
  createRemoteJWKSet: jest.fn(),
  jwtVerify: jest.fn(),
}));

import { PenaltyReason, UserRole } from '@prisma/client';
import { OrgScopeGuard } from '../auth/guards/org-scope.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { SupabaseAuthGuard } from '../auth/guards/supabase-auth.guard';
import { ORG_SCOPE_KEY } from '../common/decorators/org-scope.decorator';
import { ROLES_KEY } from '../common/decorators/roles.decorator';
import { PenaltiesController } from './penalties.controller';
import { PenaltiesService } from './penalties.service';

function handlerOf(name: 'create' | 'findAll'): object {
  return (PenaltiesController.prototype as unknown as Record<string, object>)[
    name
  ];
}

function guardsOn(handler: object): unknown[] {
  return (Reflect.getMetadata(GUARDS_METADATA, handler) as unknown[]) ?? [];
}

const bookingId = '11111111-1111-4111-8111-111111111111';
const organizationId = '22222222-2222-4222-8222-222222222222';

describe('PenaltiesController', () => {
  const create = jest.fn();
  const listForBookingVendor = jest.fn();
  const service = {
    create,
    listForBookingVendor,
  } as unknown as PenaltiesService;
  const controller = new PenaltiesController(service);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it.each(['create', 'findAll'] as const)(
    'protects %s with the full booking org-scope chain',
    (handlerName) => {
      const handler = handlerOf(handlerName);

      expect(guardsOn(handler)).toEqual([
        SupabaseAuthGuard,
        OrgScopeGuard,
        RolesGuard,
      ]);
      expect(Reflect.getMetadata(ORG_SCOPE_KEY, handler)).toBe('bookingId');
      expect(Reflect.getMetadata(ROLES_KEY, handler)).toEqual([
        UserRole.SUPER_ADMIN,
        UserRole.ORG_ADMIN,
      ]);
    },
  );

  it('passes only the resolved organization and DTO to create', async () => {
    const dto = { reason: PenaltyReason.NO_SHOW };
    create.mockResolvedValue({ trustScore: 80 });

    await controller.create(bookingId, organizationId, dto);

    expect(create).toHaveBeenCalledWith(bookingId, organizationId, dto);
  });

  it('lists the booking vendor history for the resolved organization', async () => {
    listForBookingVendor.mockResolvedValue({
      penalties: [],
      trustScore: 100,
      isBlacklisted: false,
    });

    await controller.findAll(bookingId, organizationId);

    expect(listForBookingVendor).toHaveBeenCalledWith(
      bookingId,
      organizationId,
    );
  });
});
