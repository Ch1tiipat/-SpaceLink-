import { GUARDS_METADATA } from '@nestjs/common/constants';

jest.mock('jose', () => ({
  createRemoteJWKSet: jest.fn(),
  jwtVerify: jest.fn(),
}));

import { UserRole } from '@prisma/client';
import { RolesGuard } from '../auth/guards/roles.guard';
import { SupabaseAuthGuard } from '../auth/guards/supabase-auth.guard';
import { ORG_SCOPE_KEY } from '../common/decorators/org-scope.decorator';
import { ROLES_KEY } from '../common/decorators/roles.decorator';
import { AuditLogsController } from './audit-logs.controller';
import { AuditLogsService } from './audit-logs.service';

describe('AuditLogsController', () => {
  it('should be defined', () => {
    const controller = new AuditLogsController({} as AuditLogsService);
    expect(controller).toBeDefined();
  });

  it('protects the list with SUPER_ADMIN only and no org scope', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, AuditLogsController)).toEqual([
      SupabaseAuthGuard,
      RolesGuard,
    ]);
    expect(Reflect.getMetadata(ROLES_KEY, AuditLogsController)).toEqual([
      UserRole.SUPER_ADMIN,
    ]);
    expect(
      Reflect.getMetadata(ORG_SCOPE_KEY, AuditLogsController),
    ).toBeUndefined();
  });

  it('delegates query filters to the service', async () => {
    const findAll = jest.fn().mockResolvedValue([]);
    const controller = new AuditLogsController({
      findAll,
    } as unknown as AuditLogsService);

    await controller.findAll({ action: 'ORGANIZATION_CREATED' });

    expect(findAll).toHaveBeenCalledWith({ action: 'ORGANIZATION_CREATED' });
  });
});
