import { Controller, Get, UseGuards } from '@nestjs/common';
import type { User } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { getShopLogoAvailableAt } from '../shops/shops.service';
import { toUserResponse } from '../users/user-response';
import { SupabaseAuthGuard } from './guards/supabase-auth.guard';

/**
 * The only auth endpoint. There is no register, login, logout or refresh route
 * here by design (AGENTS.md §7) — the browser talks to Supabase Auth directly.
 */
@Controller('auth')
export class AuthController {
  constructor(private readonly prisma: PrismaService) {}

  @UseGuards(SupabaseAuthGuard)
  @Get('me')
  async me(@CurrentUser() user: User) {
    const [shops, memberships] = await Promise.all([
      this.prisma.shop.findMany({
        where: { ownerUserId: user.id },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        select: {
          id: true,
          name: true,
          description: true,
          logoUrl: true,
          logoUpdatedAt: true,
          categories: {
            select: {
              category: { select: { id: true, name: true } },
            },
          },
        },
      }),
      this.prisma.orgMembership.findMany({
        where: { userId: user.id },
        orderBy: [{ joinedAt: 'asc' }, { id: 'asc' }],
        select: {
          role: true,
          organization: {
            select: { id: true, name: true, promptpayId: true },
          },
        },
      }),
    ]);

    // Shaped, not the raw row: `blacklistReason` is admin-facing only (§14.5).
    // The profile half lives in toUserResponse so PATCH /users/me returns the
    // same fields; only the `shops` half is specific to this endpoint.
    return {
      ...toUserResponse(user),
      shops: shops.map((shop) => ({
        id: shop.id,
        name: shop.name,
        description: shop.description,
        logoUrl: shop.logoUrl,
        logoAvailableAt: getShopLogoAvailableAt(shop.logoUpdatedAt),
        categories: shop.categories.map(({ category }) => category),
      })),
      organizations: memberships.map(({ role, organization }) => ({
        ...organization,
        membershipRole: role,
      })),
    };
  }
}
