import { type ExecutionContext } from '@nestjs/common';
import { GUARDS_METADATA, HTTP_CODE_METADATA } from '@nestjs/common/constants';
import { Test } from '@nestjs/testing';
import type { Server } from 'node:http';
import request from 'supertest';

jest.mock('jose', () => ({
  createRemoteJWKSet: jest.fn(),
  jwtVerify: jest.fn(),
}));

import { UserRole } from '@prisma/client';
import { OrgScopeGuard } from '../auth/guards/org-scope.guard';
import { OrgPermissionGuard } from '../auth/guards/org-permission.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { SupabaseAuthGuard } from '../auth/guards/supabase-auth.guard';
import { ORG_SCOPE_KEY } from '../common/decorators/org-scope.decorator';
import { ROLES_KEY } from '../common/decorators/roles.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { OrganizationsController } from './organizations.controller';
import { OrganizationsService } from './organizations.service';

describe('OrganizationsController', () => {
  let controller: OrganizationsController;
  const updateBookingQuota = jest.fn();
  const exportCsv = jest.fn();
  const findOne = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new OrganizationsController({
      updateBookingQuota,
      exportCsv,
      findOne,
    } as unknown as OrganizationsService);
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

  it('protects CSV export with authentication and SUPER_ADMIN only', () => {
    const handler = (
      OrganizationsController.prototype as unknown as Record<string, object>
    ).exportCsv;

    expect(Reflect.getMetadata(GUARDS_METADATA, handler)).toEqual([
      SupabaseAuthGuard,
      RolesGuard,
    ]);
    expect(Reflect.getMetadata(ROLES_KEY, handler)).toEqual([
      UserRole.SUPER_ADMIN,
    ]);
  });

  it('routes /organizations/export before :id and rejects non-super-admin roles', async () => {
    const csv = '\uFEFFname,contactEmail\r\nองค์กร,admin@example.com';
    let currentRole: UserRole = UserRole.SUPER_ADMIN;
    exportCsv.mockResolvedValue(csv);
    const fakeAuthGuard = {
      canActivate(context: ExecutionContext) {
        const httpRequest = context.switchToHttp().getRequest<{
          user?: { role: UserRole };
        }>();
        httpRequest.user = { role: currentRole };
        return true;
      },
    };
    const module = await Test.createTestingModule({
      controllers: [OrganizationsController],
      providers: [
        RolesGuard,
        { provide: PrismaService, useValue: {} },
        {
          provide: OrganizationsService,
          useValue: { exportCsv, findOne },
        },
      ],
    })
      .overrideGuard(SupabaseAuthGuard)
      .useValue(fakeAuthGuard)
      .compile();
    const app = module.createNestApplication();
    await app.init();

    try {
      await request(app.getHttpServer() as Server)
        .get('/organizations/export')
        .expect(200)
        .expect('Content-Type', /text\/csv; charset=utf-8/)
        .expect(
          'Content-Disposition',
          'attachment; filename="organizations.csv"',
        )
        .expect(csv);
      expect(exportCsv).toHaveBeenCalledTimes(1);
      expect(findOne).not.toHaveBeenCalled();

      for (const role of [UserRole.ORG_ADMIN, UserRole.VENDOR]) {
        currentRole = role;
        await request(app.getHttpServer() as Server)
          .get('/organizations/export')
          .expect(403);
      }
      expect(exportCsv).toHaveBeenCalledTimes(1);
    } finally {
      await app.close();
    }
  });

  it('protects update with auth, org scope, and role guards', () => {
    const handler = (
      OrganizationsController.prototype as unknown as Record<string, object>
    ).update;

    expect(Reflect.getMetadata(GUARDS_METADATA, handler)).toEqual([
      SupabaseAuthGuard,
      OrgScopeGuard,
      RolesGuard,
      OrgPermissionGuard,
    ]);
    expect(Reflect.getMetadata(ORG_SCOPE_KEY, handler)).toBe('organizationId');
    expect(Reflect.getMetadata(ROLES_KEY, handler)).toEqual([
      UserRole.SUPER_ADMIN,
      UserRole.ORG_ADMIN,
    ]);
  });

  it('protects quota updates with auth, org scope, and both admin roles', () => {
    const handler = (
      OrganizationsController.prototype as unknown as Record<string, object>
    ).updateBookingQuota;

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

  it('passes quota updates and the authenticated actor to the service', async () => {
    const currentUser = {
      id: '00000000-0000-4000-8000-000000000099',
      role: UserRole.ORG_ADMIN,
    };
    updateBookingQuota.mockResolvedValue({ bookingQuotaPerVendor: 3 });

    await expect(
      controller.updateBookingQuota(
        '00000000-0000-4000-8000-000000000001',
        { bookingQuotaPerVendor: 3 },
        currentUser as never,
      ),
    ).resolves.toEqual({ bookingQuotaPerVendor: 3 });

    expect(updateBookingQuota).toHaveBeenCalledWith(
      '00000000-0000-4000-8000-000000000001',
      3,
      currentUser,
      currentUser.id,
    );
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

  it('lets both admin roles list the organization team', () => {
    const handler = (
      OrganizationsController.prototype as unknown as Record<string, object>
    ).listAdmins;
    expect(Reflect.getMetadata(ROLES_KEY, handler)).toEqual([
      UserRole.SUPER_ADMIN,
      UserRole.ORG_ADMIN,
    ]);
  });

  it.each(['grantAdmin', 'revokeAdmin', 'updateAdminPermissions'])(
    'reserves %s for an organization admin whose OWNER membership is checked in the service',
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
        UserRole.ORG_ADMIN,
      ]);
    },
  );

  it('reserves owner assignment for SUPER_ADMIN', () => {
    const handler = (
      OrganizationsController.prototype as unknown as Record<string, object>
    ).setOwner;
    expect(Reflect.getMetadata(ROLES_KEY, handler)).toEqual([
      UserRole.SUPER_ADMIN,
    ]);
    expect(Reflect.getMetadata(ORG_SCOPE_KEY, handler)).toBe('organizationId');
  });

  it('returns 204 after revoking an organization admin', () => {
    const handler = (
      OrganizationsController.prototype as unknown as Record<string, object>
    ).revokeAdmin;

    expect(Reflect.getMetadata(HTTP_CODE_METADATA, handler)).toBe(204);
  });
});
