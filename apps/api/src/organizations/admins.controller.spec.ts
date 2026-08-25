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
const service = { listAllAdmins } as unknown as OrganizationsService;

function handler(): object {
  const descriptor = Object.getOwnPropertyDescriptor(
    AdminsController.prototype,
    'findAll',
  );
  if (!descriptor) {
    throw new Error('Missing controller handler: findAll');
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
});
