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
/**
 * Algorithms accepted from an asymmetric Supabase project. Supabase signs with
 * ECC P-256 or RSA depending on the key you generate, and nothing else.
 */
const JWKS_ALGORITHMS = ['ES256', 'RS256'];

/** The one algorithm a legacy shared-secret project ever signs with. */
const SECRET_ALGORITHMS = ['HS256'];

@Injectable()
export class SupabaseTokenService {
  /**
   * Either a JWKS resolver or the raw HS256 secret. Built once in the
   * constructor: createRemoteJWKSet caches the fetched keys on the instance it
   * returns, so rebuilding it per request would refetch the key set every time.
   */
  private readonly key: JWTVerifyGetKey | Uint8Array;

  /**
   * Pinned to the one scheme this project actually uses, rather than left to
   * whatever `alg` header the token arrives with. jose already refuses `none`
   * and refuses an asymmetric `alg` against a symmetric key, so this is not the
   * classic confusion attack — it is keeping the accepted set as small as the
   * truth allows, which is what the deleted passport strategy did with
   * `algorithms: ['HS256']`.
   */
  private readonly algorithms: string[];

  /**
   * Supabase stamps `iss: <project-url>/auth/v1`. Checking it means a validly
   * signed token from a *different* Supabase project cannot be replayed here —
   * relevant the moment anyone spins up a second project for staging.
   */
  private readonly issuer: string;

  constructor(config: ConfigService) {
    const jwksUrl = config.get<string>('SUPABASE_JWKS_URL');
    const secret = config.get<string>('SUPABASE_JWT_SECRET');
    const supabaseUrl = config.get<string>('SUPABASE_URL');

    if (!supabaseUrl) {
      throw new Error(
        'SUPABASE_URL is required to verify tokens — it is what the expected ' +
          'issuer is derived from.',
      );
    }

    // Built by hand rather than with `new URL`, which would throw on the
    // placeholder value .env carries until Supabase setup is finished. A
    // placeholder must still boot (CLAUDE.md §9); it just cannot verify a real
    // token, which is correct.
    this.issuer = `${supabaseUrl.replace(/\/+$/, '')}/auth/v1`;

    if (jwksUrl) {
      // Asymmetric project: keys are public and fetched from Supabase.
      this.key = createRemoteJWKSet(new URL(jwksUrl));
      this.algorithms = JWKS_ALGORITHMS;
    } else if (secret) {
      // Legacy project: one shared HS256 secret.
      this.key = new TextEncoder().encode(secret);
      this.algorithms = SECRET_ALGORITHMS;
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
   * that fails — bad signature, expired, wrong issuer or audience, unexpected
   * algorithm, missing claim — is an UnauthorizedException; the caller never
   * has to distinguish them.
   *
   * `exp` needs no option here: jose rejects an expired token by default, and
   * `verify` is called on every request rather than once at sign-in.
   */
  async verify(token: string): Promise<SupabaseTokenClaims> {
    // Supabase stamps `aud: authenticated` on user tokens; checking it stops
    // an anon or service token being accepted as a signed-in user.
    const options = {
      audience: 'authenticated',
      issuer: this.issuer,
      algorithms: this.algorithms,
    };

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
