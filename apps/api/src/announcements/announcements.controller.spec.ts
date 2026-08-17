import { GUARDS_METADATA } from '@nestjs/common/constants';

jest.mock('jose', () => ({
  createRemoteJWKSet: jest.fn(),
  jwtVerify: jest.fn(),
}));

import { UserRole } from '@prisma/client';
import { OrgScopeGuard } from '../auth/guards/org-scope.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { SupabaseAuthGuard } from '../auth/guards/supabase-auth.guard';
import { ORG_SCOPE_KEY } from '../common/decorators/org-scope.decorator';
import { ROLES_KEY } from '../common/decorators/roles.decorator';
import { AnnouncementsController } from './announcements.controller';
import { AnnouncementsService } from './announcements.service';

function handlerOf(prototype: object, name: string): object {
  return (prototype as Record<string, object>)[name];
}

function guardsOn(handler: object): unknown[] {
  return (Reflect.getMetadata(GUARDS_METADATA, handler) as unknown[]) ?? [];
}

describe('AnnouncementsController', () => {
  it('should be defined', () => {
    const controller = new AnnouncementsController({} as AnnouncementsService);

    expect(controller).toBeDefined();
  });

  it('keeps only the public list unguarded', () => {
    expect(
      Reflect.getMetadata(GUARDS_METADATA, AnnouncementsController),
    ).toBeUndefined();
    expect(
      guardsOn(handlerOf(AnnouncementsController.prototype, 'findPublic')),
    ).toEqual([]);
  });

  it.each(['findAllForAdmin', 'create', 'update', 'remove'])(
    'guards %s with the full organization-scope + role chain',
    (name) => {
      const handler = handlerOf(AnnouncementsController.prototype, name);

      expect(guardsOn(handler)).toEqual([
        SupabaseAuthGuard,
        OrgScopeGuard,
        RolesGuard,
      ]);
      expect(Reflect.getMetadata(ORG_SCOPE_KEY, handler)).toBe(
        'organizationId',
      );
      expect(Reflect.getMetadata(ROLES_KEY, handler)).toEqual([
        UserRole.SUPER_ADMIN,
        UserRole.ORG_ADMIN,
      ]);
    },
  );
});
