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
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

describe('DashboardController', () => {
  it('protects the summary with auth, org scope, and role guards', () => {
    const handler = (
      DashboardController.prototype as unknown as Record<string, object>
    ).getSummary;

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

  it('passes the organization resolved by the guard to the service', async () => {
    const getSummary = jest.fn().mockResolvedValue({});
    const controller = new DashboardController({
      getSummary,
    } as unknown as DashboardService);

    await controller.getSummary('client-route-id', ORGANIZATION_ID);

    expect(getSummary).toHaveBeenCalledWith(ORGANIZATION_ID);
  });
});

const ORGANIZATION_ID = '11111111-1111-4111-8111-111111111111';
