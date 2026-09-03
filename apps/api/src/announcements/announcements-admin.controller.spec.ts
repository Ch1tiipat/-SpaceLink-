import { ParseUUIDPipe } from '@nestjs/common';
import { GUARDS_METADATA, ROUTE_ARGS_METADATA } from '@nestjs/common/constants';

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
const removeAcrossOrganizations = jest.fn();
const service = {
  findAllAcrossOrganizations,
  removeAcrossOrganizations,
} as unknown as AnnouncementsService;

function handler(name: 'findAll' | 'remove'): object {
  const descriptor = Object.getOwnPropertyDescriptor(
    AnnouncementsAdminController.prototype,
    name,
  );
  if (!descriptor) {
    throw new Error(`Missing controller handler: ${name}`);
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
    for (const name of ['findAll', 'remove'] as const) {
      expect(Reflect.getMetadata(GUARDS_METADATA, handler(name))).toEqual([
        SupabaseAuthGuard,
        RolesGuard,
      ]);
      expect(Reflect.getMetadata(GUARDS_METADATA, handler(name))).not.toContain(
        OrgScopeGuard,
      );
      expect(Reflect.getMetadata(ORG_SCOPE_KEY, handler(name))).toBeUndefined();
      expect(Reflect.getMetadata(ROLES_KEY, handler(name))).toEqual([
        UserRole.SUPER_ADMIN,
      ]);
    }
  });

  it('returns announcements across organizations from the service', async () => {
    const announcements = [{ id: 'announcement-1' }];
    findAllAcrossOrganizations.mockResolvedValue(announcements);

    await expect(controller.findAll()).resolves.toEqual(announcements);

    expect(findAllAcrossOrganizations).toHaveBeenCalledTimes(1);
    expect(findAllAcrossOrganizations).toHaveBeenCalledWith();
  });

  it('deletes an announcement across organizations through the service', async () => {
    const announcement = { id: '00000000-0000-4000-8000-000000000002' };
    removeAcrossOrganizations.mockResolvedValue(announcement);

    await expect(controller.remove(announcement.id)).resolves.toEqual(
      announcement,
    );

    expect(removeAcrossOrganizations).toHaveBeenCalledWith(announcement.id);
  });

  it('validates the delete announcement id as a UUID', () => {
    const metadata = Reflect.getMetadata(
      ROUTE_ARGS_METADATA,
      AnnouncementsAdminController,
      'remove',
    ) as Record<string, { data?: string; pipes?: unknown[] }>;
    const idParameter = Object.values(metadata).find(
      (parameter) => parameter.data === 'announcementId',
    );

    expect(idParameter?.pipes).toEqual(
      expect.arrayContaining([expect.any(ParseUUIDPipe)]),
    );
  });
});
