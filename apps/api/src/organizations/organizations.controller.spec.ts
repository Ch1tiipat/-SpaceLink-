import { GUARDS_METADATA, HTTP_CODE_METADATA } from '@nestjs/common/constants';

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
import { OrganizationsController } from './organizations.controller';
import { OrganizationsService } from './organizations.service';

describe('OrganizationsController', () => {
  let controller: OrganizationsController;

  beforeEach(() => {
    controller = new OrganizationsController({} as OrganizationsService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('keeps public reads unguarded', () => {
    expect(
      Reflect.getMetadata(GUARDS_METADATA, OrganizationsController),
    ).toBeUndefined();
    for (const name of ['findAll', 'findOne']) {
      const handler = (
        OrganizationsController.prototype as unknown as Record<string, object>
      )[name];
      expect(Reflect.getMetadata(GUARDS_METADATA, handler)).toBeUndefined();
    }
  });

  it('protects create with authentication and SUPER_ADMIN only', () => {
    const handler = (
      OrganizationsController.prototype as unknown as Record<string, object>
    ).create;

    expect(Reflect.getMetadata(GUARDS_METADATA, handler)).toEqual([
      SupabaseAuthGuard,
      RolesGuard,
    ]);
    expect(Reflect.getMetadata(GUARDS_METADATA, handler)).not.toContain(
      OrgScopeGuard,
    );
    expect(Reflect.getMetadata(ORG_SCOPE_KEY, handler)).toBeUndefined();
    expect(Reflect.getMetadata(ROLES_KEY, handler)).toEqual([
      UserRole.SUPER_ADMIN,
    ]);
  });

  it('protects update with auth, org scope, and role guards', () => {
    const handler = (
      OrganizationsController.prototype as unknown as Record<string, object>
    ).update;

    expect(Reflect.getMetadata(GUARDS_METADATA, handler)).toEqual([
      SupabaseAuthGuard,
      OrgScopeGuard,
      RolesGuard,
    ]);
    expect(Reflect.getMetadata(ORG_SCOPE_KEY, handler)).toBe('organizationId');
    expect(Reflect.getMetadata(ROLES_KEY, handler)).toEqual([
      UserRole.SUPER_ADMIN,
      UserRole.ORG_ADMIN,
    ]);
  });

  it('protects status update with org scope and SUPER_ADMIN only', () => {
    const handler = (
      OrganizationsController.prototype as unknown as Record<string, object>
    ).updateStatus;

    expect(Reflect.getMetadata(GUARDS_METADATA, handler)).toEqual([
      SupabaseAuthGuard,
      OrgScopeGuard,
      RolesGuard,
    ]);
    expect(Reflect.getMetadata(ORG_SCOPE_KEY, handler)).toBe('organizationId');
    expect(Reflect.getMetadata(ROLES_KEY, handler)).toEqual([
      UserRole.SUPER_ADMIN,
    ]);
  });

  it.each(['listAdmins', 'grantAdmin', 'revokeAdmin'])(
    'protects %s with org scope and SUPER_ADMIN only',
    (name) => {
      const handler = (
        OrganizationsController.prototype as unknown as Record<string, object>
      )[name];

      expect(Reflect.getMetadata(GUARDS_METADATA, handler)).toEqual([
        SupabaseAuthGuard,
        OrgScopeGuard,
        RolesGuard,
      ]);
      expect(Reflect.getMetadata(ORG_SCOPE_KEY, handler)).toBe(
        'organizationId',
      );
      expect(Reflect.getMetadata(ROLES_KEY, handler)).toEqual([
        UserRole.SUPER_ADMIN,
      ]);
    },
  );

  it('returns 204 after revoking an organization admin', () => {
    const handler = (
      OrganizationsController.prototype as unknown as Record<string, object>
    ).revokeAdmin;

    expect(Reflect.getMetadata(HTTP_CODE_METADATA, handler)).toBe(204);
  });
});
