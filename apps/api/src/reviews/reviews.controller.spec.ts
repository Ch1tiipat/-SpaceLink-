import { ExecutionContext, Logger, NotFoundException } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';

jest.mock('jose', () => ({
  createRemoteJWKSet: jest.fn(),
  jwtVerify: jest.fn(),
}));

import {
  ReviewStatus,
  ReviewTargetType,
  UserRole,
  type User,
} from '@prisma/client';
import { OrgScopeGuard } from '../auth/guards/org-scope.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { SupabaseAuthGuard } from '../auth/guards/supabase-auth.guard';
import { ORG_SCOPE_KEY } from '../common/decorators/org-scope.decorator';
import { ROLES_KEY } from '../common/decorators/roles.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { ReviewsController } from './reviews.controller';
import { ReviewsService } from './reviews.service';

type HandlerName =
  | 'create'
  | 'getAverage'
  | 'getForEvent'
  | 'getMine'
  | 'listForOrganization'
  | 'hide'
  | 'restore'
  | 'softDelete';

function handlerOf(name: HandlerName): object {
  return (ReviewsController.prototype as unknown as Record<string, object>)[
    name
  ];
}

function guardsOn(handler: object): unknown[] {
  return (Reflect.getMetadata(GUARDS_METADATA, handler) as unknown[]) ?? [];
}

const currentUser = {
  id: '11111111-1111-4111-8111-111111111111',
  role: UserRole.ORG_ADMIN,
} as User;
const organizationId = '22222222-2222-4222-8222-222222222222';
const reviewId = '33333333-3333-4333-8333-333333333333';
const eventId = '44444444-4444-4444-8444-444444444444';
const bookingId = '55555555-5555-4555-8555-555555555555';
const targetId = '66666666-6666-4666-8666-666666666666';

describe('ReviewsController', () => {
  const getAverage = jest.fn();
  const getForEvent = jest.fn();
  const getMine = jest.fn();
  const listForOrganization = jest.fn();
  const create = jest.fn();
  const hide = jest.fn();
  const restore = jest.fn();
  const softDelete = jest.fn();
  const service = {
    getAverage,
    getForEvent,
    getMine,
    listForOrganization,
    create,
    hide,
    restore,
    softDelete,
  } as unknown as ReviewsService;
  const controller = new ReviewsController(service);

  beforeEach(() => jest.clearAllMocks());

  it.each(['getAverage', 'getForEvent'] as const)('keeps %s public', (name) => {
    expect(guardsOn(handlerOf(name))).toEqual([]);
  });

  it.each(['create', 'getMine'] as const)(
    'guards %s with authentication and the vendor role',
    (name) => {
      const handler = handlerOf(name);
      expect(guardsOn(handler)).toEqual([SupabaseAuthGuard, RolesGuard]);
      expect(Reflect.getMetadata(ROLES_KEY, handler)).toEqual([
        UserRole.VENDOR,
      ]);
    },
  );

  it.each([
    ['listForOrganization', 'organizationId'],
    ['hide', 'reviewId'],
    ['restore', 'reviewId'],
    ['softDelete', 'reviewId'],
  ] as const)(
    'protects %s with org scope and explicitly allows SUPER_ADMIN',
    (name, scope) => {
      const handler = handlerOf(name);
      expect(guardsOn(handler)).toEqual([
        SupabaseAuthGuard,
        OrgScopeGuard,
        RolesGuard,
      ]);
      expect(Reflect.getMetadata(ORG_SCOPE_KEY, handler)).toBe(scope);
      expect(Reflect.getMetadata(ROLES_KEY, handler)).toEqual([
        UserRole.SUPER_ADMIN,
        UserRole.ORG_ADMIN,
      ]);
    },
  );

  it('passes public and vendor inputs to the service', async () => {
    await controller.getAverage({
      targetType: ReviewTargetType.BOOTH,
      targetId,
    });
    await controller.getForEvent(eventId, { page: 2, limit: 5 });
    const dto = {
      bookingId,
      targetType: 'BOOTH' as const,
      targetId,
      rating: 5,
    };
    await controller.create(dto, currentUser);
    expect(getAverage).toHaveBeenCalledWith(ReviewTargetType.BOOTH, targetId);
    expect(getForEvent).toHaveBeenCalledWith(eventId, 2, 5);
    expect(create).toHaveBeenCalledWith(currentUser.id, dto);
  });

  it('passes resolved organization and moderation actor to the service', async () => {
    const query = { status: ReviewStatus.HIDDEN, page: 1, limit: 25 };
    await controller.listForOrganization(organizationId, query);
    await controller.hide(reviewId, { reason: 'hide' }, currentUser);
    await controller.restore(reviewId, { reason: 'restore' }, currentUser);
    await controller.softDelete(reviewId, { reason: 'delete' }, currentUser);
    expect(listForOrganization).toHaveBeenCalledWith(organizationId, query);
    expect(hide).toHaveBeenCalledWith(reviewId, currentUser.id, 'hide');
    expect(restore).toHaveBeenCalledWith(reviewId, currentUser.id, 'restore');
    expect(softDelete).toHaveBeenCalledWith(reviewId, currentUser.id, 'delete');
  });

  it.each([
    ['listForOrganization', { organizationId }],
    ['hide', { reviewId }],
    ['restore', { reviewId }],
    ['softDelete', { reviewId }],
  ] as const)(
    'answers 404 when an organization A admin calls organization B through %s',
    async (name, params) => {
      const warn = jest
        .spyOn(Logger.prototype, 'warn')
        .mockImplementation(() => undefined);
      const request = { params, user: currentUser };
      const prisma = {
        organization: {
          findUnique: jest.fn().mockResolvedValue({ id: organizationId }),
        },
        review: {
          findUnique: jest.fn().mockResolvedValue({ organizationId }),
        },
        orgMembership: { findUnique: jest.fn().mockResolvedValue(null) },
      };
      const guard = new OrgScopeGuard(
        new Reflector(),
        prisma as unknown as PrismaService,
      );
      const context = {
        getHandler: () => handlerOf(name),
        getClass: () => ReviewsController,
        switchToHttp: () => ({ getRequest: () => request }),
      } as unknown as ExecutionContext;

      const error: unknown = await guard
        .canActivate(context)
        .catch((cause: unknown) => cause);
      expect(error).toBeInstanceOf(NotFoundException);
      expect((error as NotFoundException).getResponse()).toEqual({
        statusCode: 404,
        message: 'Resource not found',
        error: 'Not Found',
      });
      warn.mockRestore();
    },
  );
});
