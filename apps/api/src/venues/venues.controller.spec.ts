import { GUARDS_METADATA } from '@nestjs/common/constants';

// See zones.controller.spec.ts — same jose/ESM shim, needed transitively via
// OrgScoped -> SupabaseAuthGuard -> SupabaseTokenService.
jest.mock('jose', () => ({
  createRemoteJWKSet: jest.fn(),
  jwtVerify: jest.fn(),
}));

import { UserRole } from '@prisma/client';
import { ORG_SCOPE_KEY } from '../common/decorators/org-scope.decorator';
import { ROLES_KEY } from '../common/decorators/roles.decorator';
import { OrgScopeGuard } from '../auth/guards/org-scope.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { SupabaseAuthGuard } from '../auth/guards/supabase-auth.guard';
import { PrismaService } from '../prisma/prisma.service';
import { ZonesService } from '../zones/zones.service';
import { VenuesController } from './venues.controller';
import { VenuesService } from './venues.service';

const mockPrismaService = {};

// See zones.controller.spec.ts for why this is bracket access on an untyped
// Record rather than `Controller.prototype.method` directly.
function handlerOf(prototype: object, name: string): object {
  return (prototype as Record<string, object>)[name];
}

function guardsOn(handler: object): unknown[] {
  return (Reflect.getMetadata(GUARDS_METADATA, handler) as unknown[]) ?? [];
}

describe('VenuesController', () => {
  let controller: VenuesController;

  beforeEach(() => {
    controller = new VenuesController(
      new VenuesService(mockPrismaService as unknown as PrismaService),
      new ZonesService(mockPrismaService as unknown as PrismaService),
    );
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('keeps public reads unguarded', () => {
    expect(
      Reflect.getMetadata(GUARDS_METADATA, VenuesController),
    ).toBeUndefined();
    expect(guardsOn(handlerOf(VenuesController.prototype, 'findAll'))).toEqual(
      [],
    );
    expect(guardsOn(handlerOf(VenuesController.prototype, 'findOne'))).toEqual(
      [],
    );
  });

  it('guards createZone with the full org-scope + role chain on venueId', () => {
    const handler = handlerOf(VenuesController.prototype, 'createZone');

    expect(guardsOn(handler)).toEqual([
      SupabaseAuthGuard,
      OrgScopeGuard,
      RolesGuard,
    ]);
    expect(Reflect.getMetadata(ORG_SCOPE_KEY, handler)).toBe('venueId');
    expect(Reflect.getMetadata(ROLES_KEY, handler)).toEqual([
      UserRole.SUPER_ADMIN,
      UserRole.ORG_ADMIN,
    ]);
  });
});
