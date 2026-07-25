import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import type { JWTPayload, JWTVerifyGetKey } from 'jose';

/** The only claims we take from a Supabase access token. Role is deliberately absent. */
export interface SupabaseTokenClaims {
  sub: string;
  email: string;
}

/**
 * Verifies Supabase-issued access tokens (CLAUDE.md §7). This backend only
 * verifies; it never signs or issues a token.
 *
 * Supabase issues either asymmetric keys (verified against a public JWKS
 * endpoint) or a legacy shared HS256 secret, and which one a project gets
 * depends on when it was created. Both are supported here and the choice is
 * made by environment variable alone — no code change when a teammate's
 * project turns out to use the other one.
 */
@Injectable()
export class SupabaseTokenService {
  /**
   * Either a JWKS resolver or the raw HS256 secret. Built once in the
   * constructor: createRemoteJWKSet caches the fetched keys on the instance it
   * returns, so rebuilding it per request would refetch the key set every time.
   */
  private readonly key: JWTVerifyGetKey | Uint8Array;

  constructor(config: ConfigService) {
    const jwksUrl = config.get<string>('SUPABASE_JWKS_URL');
    const secret = config.get<string>('SUPABASE_JWT_SECRET');

    if (jwksUrl) {
      // Asymmetric project: keys are public and fetched from Supabase.
      this.key = createRemoteJWKSet(new URL(jwksUrl));
    } else if (secret) {
      // Legacy project: one shared HS256 secret.
      this.key = new TextEncoder().encode(secret);
    } else {
      throw new Error(
        'Supabase token verification is not configured. Set SUPABASE_JWKS_URL ' +
          '(asymmetric keys — the project JWKS endpoint) or SUPABASE_JWT_SECRET ' +
          '(legacy HS256 shared secret). Exactly one is enough.',
      );
    }
  }

  /**
   * Verifies a raw bearer token and returns the two claims we use. Anything
   * that fails — bad signature, expired, wrong audience, missing claim — is an
   * UnauthorizedException; the caller never has to distinguish them.
   */
  async verify(token: string): Promise<SupabaseTokenClaims> {
    // Supabase stamps `aud: authenticated` on user tokens; checking it stops
    // an anon or service token being accepted as a signed-in user.
    const options = { audience: 'authenticated' };

    let payload: JWTPayload;
    try {
      // jwtVerify overloads a key and a key-resolver separately, so the two
      // cases are called separately rather than passing the union.
      ({ payload } =
        this.key instanceof Uint8Array
          ? await jwtVerify(token, this.key, options)
          : await jwtVerify(token, this.key, options));
    } catch {
      // The underlying error names the key, the algorithm and sometimes the
      // token itself, so it is not passed on (CLAUDE.md §14.3).
      throw new UnauthorizedException('Invalid or expired token');
    }

    const sub = payload.sub;
    const email = typeof payload.email === 'string' ? payload.email : undefined;

    // `sub` is app_user.auth_user_id; `email` seeds fullName on first sight.
    // A token lacking either cannot be provisioned against.
    if (!sub || !email) {
      throw new UnauthorizedException('Token is missing a required claim');
    }

    // Only these two. Role and org membership come from the database (§7) —
    // returning a role claim here would be enough for someone downstream to
    // trust it by mistake.
    return { sub, email };
  }
}
