import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { User } from '@prisma/client';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UserProvisioningService } from '../user-provisioning.service';

/** The claims we read from a Supabase access token. Role is deliberately absent. */
interface SupabaseJwtPayload {
  sub?: string;
  email?: string;
}

/**
 * Verifies a Supabase-issued access token (CLAUDE.md §7).
 *
 * This backend only verifies; it never signs or issues a token. `validate()`
 * returns our own `app_user` row, so `req.user` is always a database record —
 * never the raw token. Role and organization membership are read from the
 * database downstream; taking them from a claim would break tenant isolation.
 */
@Injectable()
export class SupabaseJwtStrategy extends PassportStrategy(
  Strategy,
  'supabase-jwt',
) {
  constructor(
    config: ConfigService,
    private readonly userProvisioning: UserProvisioningService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: config.getOrThrow<string>('SUPABASE_JWT_SECRET'),
      algorithms: ['HS256'],
      audience: 'authenticated',
      ignoreExpiration: false,
    });
  }

  async validate(payload: SupabaseJwtPayload): Promise<User> {
    const authUserId = payload.sub;
    const email = payload.email;

    // `sub` is app_user.auth_user_id; `email` seeds fullName on first sight.
    // A token lacking either cannot be provisioned against.
    if (!authUserId || !email) {
      throw new UnauthorizedException('Token is missing a required claim');
    }

    return this.userProvisioning.findOrCreate(authUserId, email);
  }
}
