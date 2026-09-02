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
import { AdminsController } from './admins.controller';
import { OrganizationsService } from './organizations.service';

const listAllAdmins = jest.fn();
const setQuotaEditPermission = jest.fn();
const service = {
  listAllAdmins,
  setQuotaEditPermission,
} as unknown as OrganizationsService;

function handler(
  name: 'findAll' | 'updateQuotaPermission' = 'findAll',
): object {
  const descriptor = Object.getOwnPropertyDescriptor(
    AdminsController.prototype,
    name,
  );
  if (!descriptor) {
    throw new Error(`Missing controller handler: ${name}`);
  }
  return descriptor.value as object;
}

describe('AdminsController', () => {
  const controller = new AdminsController(service);

  beforeEach(() => jest.clearAllMocks());

  it('protects the cross-organization route with SUPER_ADMIN only', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, handler())).toEqual([
      SupabaseAuthGuard,
      RolesGuard,
    ]);
    expect(Reflect.getMetadata(GUARDS_METADATA, handler())).not.toContain(
      OrgScopeGuard,
    );
    expect(Reflect.getMetadata(ORG_SCOPE_KEY, handler())).toBeUndefined();
    expect(Reflect.getMetadata(ROLES_KEY, handler())).toEqual([
      UserRole.SUPER_ADMIN,
    ]);
  });

  it('returns all organization admins from the service', async () => {
    const admins = [{ id: 'membership-1' }];
    listAllAdmins.mockResolvedValue(admins);

    await expect(controller.findAll()).resolves.toEqual(admins);

    expect(listAllAdmins).toHaveBeenCalledTimes(1);
    expect(listAllAdmins).toHaveBeenCalledWith();
  });

  it('protects quota permission updates with SUPER_ADMIN only', () => {
    const updateHandler = handler('updateQuotaPermission');

    expect(Reflect.getMetadata(GUARDS_METADATA, updateHandler)).toEqual([
      SupabaseAuthGuard,
      RolesGuard,
    ]);
    expect(Reflect.getMetadata(GUARDS_METADATA, updateHandler)).not.toContain(
      OrgScopeGuard,
    );
    expect(Reflect.getMetadata(ORG_SCOPE_KEY, updateHandler)).toBeUndefined();
    expect(Reflect.getMetadata(ROLES_KEY, updateHandler)).toEqual([
      UserRole.SUPER_ADMIN,
    ]);
  });

  it('passes the membership, permission, and actor to the service', async () => {
    setQuotaEditPermission.mockResolvedValue({
      id: 'membership-1',
      canEditQuota: true,
    });

    await expect(
      controller.updateQuotaPermission('membership-1', { canEditQuota: true }, {
        id: 'actor-1',
      } as never),
    ).resolves.toEqual({ id: 'membership-1', canEditQuota: true });

    expect(setQuotaEditPermission).toHaveBeenCalledWith(
      'membership-1',
      true,
      'actor-1',
    );
  });
});
