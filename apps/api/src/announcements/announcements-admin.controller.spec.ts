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
import { AnnouncementsAdminController } from './announcements-admin.controller';
import { AnnouncementsService } from './announcements.service';

const findAllAcrossOrganizations = jest.fn();
const service = {
  findAllAcrossOrganizations,
} as unknown as AnnouncementsService;

function handler(): object {
  const descriptor = Object.getOwnPropertyDescriptor(
    AnnouncementsAdminController.prototype,
    'findAll',
  );
  if (!descriptor) {
    throw new Error('Missing controller handler: findAll');
  }
  return descriptor.value as object;
}

describe('AnnouncementsAdminController', () => {
  const controller = new AnnouncementsAdminController(service);

  beforeEach(() => jest.clearAllMocks());

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

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

  it('returns announcements across organizations from the service', async () => {
    const announcements = [{ id: 'announcement-1' }];
    findAllAcrossOrganizations.mockResolvedValue(announcements);

    await expect(controller.findAll()).resolves.toEqual(announcements);

    expect(findAllAcrossOrganizations).toHaveBeenCalledTimes(1);
    expect(findAllAcrossOrganizations).toHaveBeenCalledWith();
  });
});
