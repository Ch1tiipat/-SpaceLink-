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

const createForUser = jest.fn();
const findAllAcrossOrganizations = jest.fn();
const service = {
  createForUser,
  findAllAcrossOrganizations,
} as unknown as PenaltiesService;

function handler(name: 'create' | 'findAll'): object {
  const descriptor = Object.getOwnPropertyDescriptor(
    PenaltiesAdminController.prototype,
    name,
  );
  if (!descriptor) {
    throw new Error(`Missing controller handler: ${name}`);
  }
  return descriptor.value as object;
}

describe('PenaltiesAdminController', () => {
  const controller = new PenaltiesAdminController(service);

  beforeEach(() => jest.clearAllMocks());

  it.each(['create', 'findAll'] as const)(
    'protects %s with SUPER_ADMIN only and no org scope',
    (name) => {
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
    },
  );

  it('passes the validated direct penalty DTO to the service', async () => {
    const dto = {
      organizationId: '22222222-2222-4222-8222-222222222222',
      userId: '33333333-3333-4333-8333-333333333333',
      reason: 'NO_SHOW' as const,
      points: 20,
    };
    createForUser.mockResolvedValue({ trustScore: 80 });

    await expect(controller.create(dto)).resolves.toEqual({ trustScore: 80 });
    expect(createForUser).toHaveBeenCalledWith(dto);
  });

  it('returns penalties and blacklisted users from the service', async () => {
    const payload = { penalties: [], blacklistedUsers: [] };
    findAllAcrossOrganizations.mockResolvedValue(payload);

    await expect(controller.findAll()).resolves.toEqual(payload);

    expect(findAllAcrossOrganizations).toHaveBeenCalledWith();
  });
});
