import {
  BadRequestException,
  ExecutionContext,
  ForbiddenException,
  Logger,
  NotFoundException,
  ValidationPipe,
} from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';
import { OrgStatus, UserRole, VenueStatus } from '@prisma/client';

jest.mock('jose', () => ({
  createRemoteJWKSet: jest.fn(),
  jwtVerify: jest.fn(),
}));

import { OrgScopeGuard } from '../auth/guards/org-scope.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { SupabaseAuthGuard } from '../auth/guards/supabase-auth.guard';
import { ORG_SCOPE_KEY } from '../common/decorators/org-scope.decorator';
import { ROLES_KEY } from '../common/decorators/roles.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { CreateVenueDto } from '../venues/dto/create-venue.dto';
import { UpdateVenueDto } from '../venues/dto/update-venue.dto';
import { VenuesController } from '../venues/venues.controller';
import { VenuesService } from '../venues/venues.service';
import { OrganizationVenuesController } from './organization-venues.controller';

const orgId = '11111111-1111-4111-8111-111111111111';
const venueId = '22222222-2222-4222-8222-222222222222';
const routes = [
  {
    name: 'create',
    controller: OrganizationVenuesController,
    scope: 'organizationId',
  },
  { name: 'update', controller: VenuesController, scope: 'venueId' },
  { name: 'remove', controller: VenuesController, scope: 'venueId' },
];

describe('Venue mutation authorization', () => {
  afterEach(() => jest.restoreAllMocks());

  it('registers create with the full guard chain', () => {
    const handler = (
      OrganizationVenuesController.prototype as unknown as Record<
        string,
        object
      >
    ).create;
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

  describe.each(routes)('$name', ({ name, controller, scope }) => {
    function setup(
      role: UserRole,
      membership: object | null = { id: 'membership' },
    ) {
      const request = {
        params: { organizationId: orgId, venueId },
        user: { id: 'admin', role },
        organizationId: undefined as string | undefined,
      };
      const context = {
        getHandler: () =>
          (controller.prototype as unknown as Record<string, object>)[name],
        getClass: () => controller,
        switchToHttp: () => ({ getRequest: () => request }),
      } as unknown as ExecutionContext;
      const prisma = {
        venue: {
          findUnique: jest.fn().mockResolvedValue({ organizationId: orgId }),
        },
        organization: {
          findUnique: jest
            .fn()
            .mockResolvedValue({ id: orgId, status: OrgStatus.ACTIVE }),
        },
        orgMembership: { findUnique: jest.fn().mockResolvedValue(membership) },
      };
      return {
        context,
        request,
        prisma,
        guard: new OrgScopeGuard(
          new Reflector(),
          prisma as unknown as PrismaService,
        ),
      };
    }

    it.each([UserRole.ORG_ADMIN, UserRole.SUPER_ADMIN])(
      'allows %s and resolves organization',
      async (role) => {
        const { guard, context, request, prisma } = setup(role);
        expect(await guard.canActivate(context)).toBe(true);
        expect(new RolesGuard(new Reflector()).canActivate(context)).toBe(true);
        expect(request.organizationId).toBe(orgId);
        if (scope === 'venueId')
          expect(prisma.venue.findUnique).toHaveBeenCalledWith({
            where: { id: venueId },
            select: { organizationId: true },
          });
      },
    );

    it('returns 404 for a different organization admin', async () => {
      jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
      const { guard, context } = setup(UserRole.ORG_ADMIN, null);
      await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('rejects a vendor even with a membership', async () => {
      const { guard, context } = setup(UserRole.VENDOR);
      expect(await guard.canActivate(context)).toBe(true);
      expect(() =>
        new RolesGuard(new Reflector()).canActivate(context),
      ).toThrow(ForbiddenException);
    });
  });
});

describe('Venue body validation', () => {
  const pipe = new ValidationPipe({ whitelist: true, transform: true });
  const metadata = { type: 'body' as const, metatype: CreateVenueDto };

  it('strips client organization and status before calling create', async () => {
    const input = (await pipe.transform(
      {
        name: 'ตลาดใหม่',
        organizationId: 'other',
        status: 'ACTIVE',
        latitude: '13.123456',
        longitude: '-100.12',
      },
      metadata,
    )) as CreateVenueDto;
    expect(input).toEqual({
      name: 'ตลาดใหม่',
      latitude: '13.123456',
      longitude: '-100.12',
    });
    const create = jest
      .fn()
      .mockResolvedValue({ id: venueId, status: VenueStatus.DRAFT });
    const controller = new OrganizationVenuesController({
      create,
    } as unknown as VenuesService);
    await expect(controller.create(orgId, input)).resolves.toEqual({
      id: venueId,
      status: VenueStatus.DRAFT,
    });
    expect(create).toHaveBeenCalledWith(input, orgId);
  });

  it.each([
    {},
    { name: '' },
    { name: 'x'.repeat(201) },
    { name: 'x', description: 'x'.repeat(2001) },
    { name: 'x', address: 'x'.repeat(501) },
    { name: 'x', mapImageUrl: 'x'.repeat(2001) },
    { name: 'x', latitude: 13 },
    { name: 'x', longitude: 100 },
    { name: 'x', latitude: '1.1234567' },
    { name: 'x', longitude: '1000' },
  ])('rejects invalid create input %#', async (input) => {
    await expect(pipe.transform(input, metadata)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('accepts archive without requiring create fields and strips organization', async () => {
    await expect(
      pipe.transform(
        { status: 'ARCHIVED', organizationId: 'other' },
        { ...metadata, metatype: UpdateVenueDto },
      ),
    ).resolves.toEqual({ status: 'ARCHIVED' });
    await expect(
      pipe.transform(
        { status: 'INVALID' },
        { ...metadata, metatype: UpdateVenueDto },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
