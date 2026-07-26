import { Controller, Get, UseGuards } from '@nestjs/common';
import type { User } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { SupabaseAuthGuard } from './guards/supabase-auth.guard';

/**
 * The only auth endpoint. There is no register, login, logout or refresh route
 * here by design (AGENTS.md §7) — the browser talks to Supabase Auth directly.
 */
@Controller('auth')
export class AuthController {
  @UseGuards(SupabaseAuthGuard)
  @Get('me')
  me(@CurrentUser() user: User) {
    // Shaped, not the raw row: `blacklistReason` is admin-facing only (§14.5).
    return {
      id: user.id,
      authUserId: user.authUserId,
      email: user.email,
      fullName: user.fullName,
      phone: user.phone,
      role: user.role,
      isBlacklisted: user.isBlacklisted,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
