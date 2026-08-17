import { GUARDS_METADATA } from '@nestjs/common/constants';

jest.mock('jose', () => ({
  createRemoteJWKSet: jest.fn(),
  jwtVerify: jest.fn(),
}));

import { ReviewTargetType, UserRole, type User } from '@prisma/client';
import { RolesGuard } from '../auth/guards/roles.guard';
import { SupabaseAuthGuard } from '../auth/guards/supabase-auth.guard';
import { ROLES_KEY } from '../common/decorators/roles.decorator';
import { ReviewsController } from './reviews.controller';
import { ReviewsService } from './reviews.service';

function handlerOf(name: 'create' | 'getAverage'): object {
  return (ReviewsController.prototype as unknown as Record<string, object>)[
    name
  ];
}

function guardsOn(handler: object): unknown[] {
  return (Reflect.getMetadata(GUARDS_METADATA, handler) as unknown[]) ?? [];
}

const currentUser = {
  id: '11111111-1111-4111-8111-111111111111',
} as User;
const targetId = '22222222-2222-4222-8222-222222222222';

describe('ReviewsController', () => {
  const getAverage = jest.fn();
  const create = jest.fn();
  const service = { getAverage, create } as unknown as ReviewsService;
  const controller = new ReviewsController(service);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('keeps the average endpoint public', () => {
    expect(
      Reflect.getMetadata(GUARDS_METADATA, ReviewsController),
    ).toBeUndefined();
    expect(guardsOn(handlerOf('getAverage'))).toEqual([]);
  });

  it('guards only create with authentication and the vendor role', () => {
    const handler = handlerOf('create');

    expect(guardsOn(handler)).toEqual([SupabaseAuthGuard, RolesGuard]);
    expect(Reflect.getMetadata(ROLES_KEY, handler)).toEqual([UserRole.VENDOR]);
  });

  it('passes the public average query to the service', async () => {
    getAverage.mockResolvedValue({ average: null, count: 0 });

    await controller.getAverage({
      targetType: ReviewTargetType.BOOTH,
      targetId,
    });

    expect(getAverage).toHaveBeenCalledWith(ReviewTargetType.BOOTH, targetId);
  });

  it('uses the authenticated database user id when creating a review', async () => {
    const dto = {
      targetType: 'BOOTH' as const,
      targetId,
      rating: 5,
    };
    create.mockResolvedValue({ id: 'review-id' });

    await controller.create(dto, currentUser);

    expect(create).toHaveBeenCalledWith(currentUser.id, dto);
  });
});
