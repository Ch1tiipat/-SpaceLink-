import { GUARDS_METADATA } from '@nestjs/common/constants';
import type { User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthController } from './auth.controller';
import { SupabaseAuthGuard } from './guards/supabase-auth.guard';

// The real guard loads jose's ESM-only runtime. This unit test exercises the
// controller contract, so a guard seam keeps Jest isolated from token parsing.
jest.mock('./guards/supabase-auth.guard', () => ({
  SupabaseAuthGuard: class SupabaseAuthGuard {},
}));

describe('AuthController', () => {
  const findMany = jest.fn();
  const controller = new AuthController({
    shop: { findMany },
  } as unknown as PrismaService);

  const user: User = {
    id: '00000000-0000-4000-8000-000000000001',
    authUserId: '00000000-0000-4000-8000-000000000002',
    email: 'vendor@example.com',
    fullName: 'Vendor One',
    phone: null,
    role: 'VENDOR',
    isBlacklisted: false,
    blacklistReason: 'must stay private',
    createdAt: new Date('2026-08-01T00:00:00.000Z'),
    updatedAt: new Date('2026-08-01T00:00:00.000Z'),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('protects the profile endpoint with Supabase authentication', () => {
    const descriptor = Object.getOwnPropertyDescriptor(
      AuthController.prototype,
      'me',
    );
    expect(descriptor?.value).toBeDefined();
    expect(
      Reflect.getMetadata(GUARDS_METADATA, descriptor?.value as object),
    ).toEqual([SupabaseAuthGuard]);
  });

  it('returns vendor-owned shops with flattened product categories', async () => {
    findMany.mockResolvedValue([
      {
        id: '00000000-0000-4000-8000-000000000010',
        name: 'ร้านเกษตรดี',
        description: 'ผักและผลไม้',
        logoUrl: null,
        categories: [
          {
            category: {
              id: '00000000-0000-4000-8000-000000000020',
              name: 'Agriculture & OTOP',
            },
          },
        ],
      },
    ]);

    const result = await controller.me(user);

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { ownerUserId: user.id } }),
    );
    expect(result.shops).toEqual([
      {
        id: '00000000-0000-4000-8000-000000000010',
        name: 'ร้านเกษตรดี',
        description: 'ผักและผลไม้',
        logoUrl: null,
        categories: [
          {
            id: '00000000-0000-4000-8000-000000000020',
            name: 'Agriculture & OTOP',
          },
        ],
      },
    ]);
    expect(result).not.toHaveProperty('blacklistReason');
  });
});
