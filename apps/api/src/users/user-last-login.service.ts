import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const REQUEST_TIMEOUT_MS = 10_000;

interface SupabaseAdminUserResponse {
  last_sign_in_at?: string | null;
}

/**
 * Best-effort read of Supabase Auth's `last_sign_in_at` for the Admin detail
 * page (SCRUM-99). There is no column for this in `app_user` and the schema
 * is frozen (§2.1), so this talks to Supabase's Auth Admin API directly
 * instead of Prisma — the one other precedent for this in the codebase is
 * ShopLogoStorageService, which this mirrors in structure.
 *
 * Any failure here (network, timeout, non-2xx from Supabase, or a user who
 * has simply never signed in) resolves to `null` rather than throwing, per
 * SCRUM-99 AC4: this must never turn into a 500 that takes the rest of the
 * Admin detail page down with it.
 */
@Injectable()
export class UserLastLoginService {
  private readonly logger = new Logger(UserLastLoginService.name);
  private readonly supabaseUrl: string;
  private readonly serviceRoleKey: string;

  constructor(config: ConfigService) {
    this.supabaseUrl = config
      .getOrThrow<string>('SUPABASE_URL')
      .replace(/\/+$/, '');
    this.serviceRoleKey = config.getOrThrow<string>(
      'SUPABASE_SERVICE_ROLE_KEY',
    );
  }

  async getLastSignInAt(authUserId: string): Promise<string | null> {
    try {
      const response = await fetch(
        `${this.supabaseUrl}/auth/v1/admin/users/${encodeURIComponent(authUserId)}`,
        {
          headers: {
            apikey: this.serviceRoleKey,
            Authorization: `Bearer ${this.serviceRoleKey}`,
          },
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        },
      );

      if (!response.ok) {
        this.logger.warn(
          `Supabase Auth Admin API returned ${response.status} for user ${authUserId}`,
        );
        return null;
      }

      const body = (await response.json()) as SupabaseAdminUserResponse;
      return body.last_sign_in_at ?? null;
    } catch (error) {
      this.logger.warn(
        `Failed to fetch last sign-in for ${authUserId}: ` +
          `${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }
}
