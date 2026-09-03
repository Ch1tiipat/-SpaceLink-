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
  const logoUpdatedAt = new Date('2026-09-01T02:00:00.000Z');
  const logoAvailableAt = '2026-09-08T02:00:00.000Z';
  const shopFindMany = jest.fn();
  const membershipFindMany = jest.fn();
  const controller = new AuthController({
    shop: { findMany: shopFindMany },
    orgMembership: { findMany: membershipFindMany },
  } as unknown as PrismaService);

  const user: User = {
    id: '00000000-0000-4000-8000-000000000001',
    authUserId: '00000000-0000-4000-8000-000000000002',
    email: 'vendor@example.com',
    fullName: 'Vendor One',
    phone: null,
    role: 'VENDOR',
    trustScore: 100,
    isBlacklisted: false,
    blacklistReason: 'must stay private',
    createdAt: new Date('2026-08-01T00:00:00.000Z'),
    updatedAt: new Date('2026-08-01T00:00:00.000Z'),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    membershipFindMany.mockResolvedValue([]);
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
    shopFindMany.mockResolvedValue([
      {
        id: '00000000-0000-4000-8000-000000000010',
        name: 'ร้านเกษตรดี',
        description: 'ผักและผลไม้',
        logoUrl: null,
        logoUpdatedAt,
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

    expect(shopFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { ownerUserId: user.id } }),
    );
    const [shopQuery] = shopFindMany.mock.calls[0] as [
      { select: { logoUpdatedAt: boolean } },
    ];
    expect(shopQuery.select.logoUpdatedAt).toBe(true);
    expect(result.shops).toEqual([
      {
        id: '00000000-0000-4000-8000-000000000010',
        name: 'ร้านเกษตรดี',
        description: 'ผักและผลไม้',
        logoUrl: null,
        logoAvailableAt,
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

  it('returns only organizations linked to the authenticated user', async () => {
    shopFindMany.mockResolvedValue([]);
    membershipFindMany.mockResolvedValue([
      {
        role: 'ADMIN',
        canEditQuota: true,
        organization: {
          id: '00000000-0000-4000-8000-000000000030',
          name: 'SpaceLink Organizer',
          promptpayId: '0812345678',
          orgConfig: { bookingQuotaPerVendor: 3 },
        },
      },
      {
        role: 'ADMIN',
        canEditQuota: false,
        organization: {
          id: '00000000-0000-4000-8000-000000000031',
          name: 'Second Organizer',
          promptpayId: null,
          orgConfig: null,
        },
      },
    ]);

    const result = await controller.me(user);

    expect(membershipFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: user.id } }),
    );
    const [membershipQuery] = membershipFindMany.mock.calls[0] as [
      {
        select: {
          canEditQuota: boolean;
          organization: {
            select: {
              orgConfig: { select: { bookingQuotaPerVendor: boolean } };
            };
          };
        };
      },
    ];
    expect(membershipQuery.select.canEditQuota).toBe(true);
    expect(
      membershipQuery.select.organization.select.orgConfig.select
        .bookingQuotaPerVendor,
    ).toBe(true);
    expect(result.organizations).toEqual([
      {
        id: '00000000-0000-4000-8000-000000000030',
        name: 'SpaceLink Organizer',
        promptpayId: '0812345678',
        membershipRole: 'ADMIN',
        canEditQuota: true,
        bookingQuotaPerVendor: 3,
      },
      {
        id: '00000000-0000-4000-8000-000000000031',
        name: 'Second Organizer',
        promptpayId: null,
        membershipRole: 'ADMIN',
        canEditQuota: false,
        bookingQuotaPerVendor: null,
      },
    ]);
  });
});
