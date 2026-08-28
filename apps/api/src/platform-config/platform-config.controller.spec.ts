import { GUARDS_METADATA } from '@nestjs/common/constants';
import { UserRole } from '@prisma/client';
import type { User } from '@prisma/client';

jest.mock('jose', () => ({
  createRemoteJWKSet: jest.fn(),
  jwtVerify: jest.fn(),
}));

import { RolesGuard } from '../auth/guards/roles.guard';
import { SupabaseAuthGuard } from '../auth/guards/supabase-auth.guard';
import { ROLES_KEY } from '../common/decorators/roles.decorator';
import { PlatformConfigController } from './platform-config.controller';
import { PlatformConfigService } from './platform-config.service';

describe('PlatformConfigController', () => {
  const currentUser = { id: 'super-admin-1' } as User;
  const findBillingConfig = jest.fn();
  const updateBillingConfig = jest.fn();
  const service = {
    findBillingConfig,
    updateBillingConfig,
  } as unknown as PlatformConfigService;
  const controller = new PlatformConfigController(service);

  beforeEach(() => jest.clearAllMocks());

  it('protects every route with authentication and SUPER_ADMIN role', () => {
    expect(
      Reflect.getMetadata(GUARDS_METADATA, PlatformConfigController),
    ).toEqual([SupabaseAuthGuard, RolesGuard]);
    expect(Reflect.getMetadata(ROLES_KEY, PlatformConfigController)).toEqual([
      UserRole.SUPER_ADMIN,
    ]);
  });

  it('forwards reads and updates to the service', async () => {
    findBillingConfig.mockResolvedValue({ id: null });
    updateBillingConfig.mockResolvedValue({ id: 'config-1' });

    await expect(controller.findBillingConfig()).resolves.toEqual({ id: null });
    await expect(
      controller.updateBillingConfig({ baseFee: '500' }, currentUser),
    ).resolves.toEqual({ id: 'config-1' });
    expect(updateBillingConfig).toHaveBeenCalledWith(
      { baseFee: '500' },
      'super-admin-1',
    );
  });
});
