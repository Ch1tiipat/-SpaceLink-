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
import { PenaltiesAdminController } from './penalties-admin.controller';
import { PenaltiesService } from './penalties.service';

const findAllAcrossOrganizations = jest.fn();
const service = {
  findAllAcrossOrganizations,
} as unknown as PenaltiesService;

function handler(): object {
  const descriptor = Object.getOwnPropertyDescriptor(
    PenaltiesAdminController.prototype,
    'findAll',
  );
  if (!descriptor) {
    throw new Error('Missing controller handler: findAll');
  }
  return descriptor.value as object;
}

describe('PenaltiesAdminController', () => {
  const controller = new PenaltiesAdminController(service);

  beforeEach(() => jest.clearAllMocks());

  it('protects the cross-organization list with SUPER_ADMIN only', () => {
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

  it('returns penalties and blacklisted users from the service', async () => {
    const payload = { penalties: [], blacklistedUsers: [] };
    findAllAcrossOrganizations.mockResolvedValue(payload);

    await expect(controller.findAll()).resolves.toEqual(payload);

    expect(findAllAcrossOrganizations).toHaveBeenCalledWith();
  });
});
