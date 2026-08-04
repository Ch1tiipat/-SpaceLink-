import { GUARDS_METADATA } from '@nestjs/common/constants';

/*
 * `jose` ships ESM only, and importing OrgScoped reaches it through
 * SupabaseAuthGuard -> SupabaseTokenService. This suite never runs a real
 * guard, it only inspects the metadata the decorators attached, so stubbing
 * the module keeps the import loadable under the CommonJS jest setup. Same
 * shim used in org-scoped.decorator.spec.ts.
 */
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
import { BoothsService } from '../booths/booths.service';
import { PrismaService } from '../prisma/prisma.service';
import { ZonesController } from './zones.controller';
import { ZonesService } from './zones.service';

const mockPrismaService = {};

/**
 * Reads a handler off a real controller's prototype by name. Bracket access
 * through an untyped Record — not `Controller.prototype.method` — because the
 * latter is a bound-method reference `@typescript-eslint/unbound-method`
 * flags, and these handlers use `this` internally so they can't be annotated
 * `this: void` the way the decorator-only test doubles in
 * org-scoped.decorator.spec.ts are.
 */
function handlerOf(prototype: object, name: string): object {
  return (prototype as Record<string, object>)[name];
}

function guardsOn(handler: object): unknown[] {
  return (Reflect.getMetadata(GUARDS_METADATA, handler) as unknown[]) ?? [];
}

describe('ZonesController', () => {
  let controller: ZonesController;

  beforeEach(() => {
    controller = new ZonesController(
      new ZonesService(mockPrismaService as unknown as PrismaService),
      new BoothsService(mockPrismaService as unknown as PrismaService),
    );
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('keeps public reads unguarded', () => {
    expect(
      Reflect.getMetadata(GUARDS_METADATA, ZonesController),
    ).toBeUndefined();
    expect(guardsOn(handlerOf(ZonesController.prototype, 'findAll'))).toEqual(
      [],
    );
    expect(guardsOn(handlerOf(ZonesController.prototype, 'findOne'))).toEqual(
      [],
    );
  });

  /*
   * Mutation routes must go through the full chain in this exact order —
   * SupabaseAuthGuard first (so request.user exists), then OrgScopeGuard and
   * RolesGuard. See the comment on OrgScoped in org-scoped.decorator.ts for
   * why RolesGuard cannot literally sit between the other two.
   */
  it.each(['update', 'remove', 'createBooth'])(
    'guards %s with the full org-scope + role chain on zoneId',
    (name) => {
      const handler = handlerOf(ZonesController.prototype, name);

      expect(guardsOn(handler)).toEqual([
        SupabaseAuthGuard,
        OrgScopeGuard,
        RolesGuard,
      ]);
      expect(Reflect.getMetadata(ORG_SCOPE_KEY, handler)).toBe('zoneId');
      expect(Reflect.getMetadata(ROLES_KEY, handler)).toEqual([
        UserRole.SUPER_ADMIN,
        UserRole.ORG_ADMIN,
      ]);
    },
  );
});
