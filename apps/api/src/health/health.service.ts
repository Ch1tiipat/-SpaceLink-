import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/** How long one completed database check stands in for the next. */
const CACHE_TTL_MS = 10_000;

type DbStatus = { status: 'ok'; database: 'up' };

/**
 * A finished check, kept so the next caller inside the window can be given the
 * same answer. The failure case holds the exception rather than re-deriving it,
 * so a cached failure is indistinguishable from a fresh one to the client.
 */
type CachedCheck =
  | { ok: true; value: DbStatus }
  | { ok: false; error: ServiceUnavailableException };

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  private cache: { expiresAt: number; check: CachedCheck } | null = null;

  /** The probe currently in flight, if any. See `currentCheck`. */
  private inFlight: Promise<CachedCheck> | null = null;

  constructor(private readonly prisma: PrismaService) {}

  /** Liveness only — deliberately touches nothing but the process itself. */
  getStatus() {
    return {
      status: 'ok',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Readiness: the cheapest query that proves a connection can be opened.
   *
   * The result is cached for {@link CACHE_TTL_MS}, success and failure alike.
   * DATABASE_URL carries `connection_limit=1` (AGENTS.md §9), so this route —
   * which is unauthenticated, because a host has no token when it probes — is
   * one connection per hit away from starving the application's own pool. Ten
   * seconds is well inside any platform's health-check interval, so a real
   * outage is still noticed promptly.
   *
   * Caching the failure matters as much as caching the success: a database that
   * is down is exactly the one that must not be re-dialled on every request,
   * and each retry costs a connection attempt and a timeout.
   *
   * A failure here is expected while Supabase does not exist yet (AGENTS.md
   * §12) — it is reported, never rethrown as-is. Prisma's message can name the
   * host and port it tried to reach, so only a fixed string reaches the client.
   */
  async checkDatabase(): Promise<DbStatus> {
    const check = await this.currentCheck();

    if (!check.ok) {
      throw check.error;
    }

    return check.value;
  }

  private currentCheck(): Promise<CachedCheck> {
    const cached = this.cache;

    if (cached && cached.expiresAt > Date.now()) {
      return Promise.resolve(cached.check);
    }

    // A burst arriving on a cold cache would otherwise open one connection
    // each, which is the failure this cache exists to prevent — the cache only
    // fills once the first probe returns. Callers that arrive while a probe is
    // running share its result instead of starting their own.
    this.inFlight ??= this.probe().finally(() => {
      this.inFlight = null;
    });

    return this.inFlight;
  }

  private async probe(): Promise<CachedCheck> {
    let check: CachedCheck;

    try {
      await this.prisma.$queryRaw`SELECT 1`;
      check = { ok: true, value: { status: 'ok', database: 'up' } };
    } catch (error) {
      // Inside the probe, so a down database is logged once per window rather
      // than once per request.
      this.logger.error(
        'Database health check failed',
        error instanceof Error ? error.stack : String(error),
      );
      check = {
        ok: false,
        error: new ServiceUnavailableException({
          status: 'error',
          database: 'down',
          message: 'Database is unavailable',
        }),
      };
    }

    this.cache = { expiresAt: Date.now() + CACHE_TTL_MS, check };

    return check;
  }
}
