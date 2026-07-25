import { Inject, Injectable, Logger } from '@nestjs/common';
import { Prisma, RecommendationSource } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RuleBasedZoneRecommender } from './providers/rule-based-recommender';
import { ZONE_RECOMMENDER } from './zone-recommender.interface';
import type {
  RecommendedBooth,
  ZoneRecommendationInput,
  ZoneRecommender,
} from './zone-recommender.interface';

/**
 * How long the configured provider gets before it is treated as failed. A
 * vendor waiting on a booth suggestion must not wait on a hung HTTP call — the
 * rule-based engine answers from the database in milliseconds.
 */
const PROVIDER_TIMEOUT_MS = 5000;

/**
 * The entry point calling services use. **Inject this, not `ZONE_RECOMMENDER`.**
 * The token stays internal to AiModule so that everything below is guaranteed
 * to have happened:
 *
 *   1. **Fallback.** If the configured provider throws, times out, or returns
 *      something malformed, the rule-based engine answers instead. The caller
 *      never sees the failure — from the outside the feature either works or is
 *      quietly a little less clever (AGENTS.md §4).
 *   2. **Persistence.** Every returned booth is written to `recommendation_log`
 *      with the source that *actually* produced it, not the one configured.
 *
 * Providers stay pure: they rank booths and return them. They do not log, do
 * not persist, and never call each other.
 */
@Injectable()
export class ZoneRecommendationService {
  private readonly logger = new Logger(ZoneRecommendationService.name);

  constructor(
    @Inject(ZONE_RECOMMENDER) private readonly provider: ZoneRecommender,
    private readonly ruleBased: RuleBasedZoneRecommender,
    private readonly prisma: PrismaService,
  ) {}

  async recommend(input: ZoneRecommendationInput): Promise<RecommendedBooth[]> {
    const booths = await this.rank(input);

    await this.record(input, booths);

    return booths;
  }

  private async rank(
    input: ZoneRecommendationInput,
  ): Promise<RecommendedBooth[]> {
    // When the configured provider *is* the rule-based engine there is nothing
    // to fall back to, so its errors are the real answer and propagate: an
    // unknown event is a 404, not an empty recommendation list. Running it a
    // second time here would only repeat the same failing query.
    if (this.provider === this.ruleBased) {
      return this.ruleBased.recommend(input);
    }

    try {
      const booths = await withTimeout(
        this.provider.recommend(input),
        PROVIDER_TIMEOUT_MS,
      );

      if (!isWellFormed(booths)) {
        throw new Error(
          'Recommender returned a malformed result — expected RecommendedBooth[]',
        );
      }

      return booths;
    } catch (error) {
      // Message only, never the whole error: a provider error body can echo the
      // request back, and this line goes to a shared log.
      this.logger.warn(
        `Zone recommender failed for event ${input.eventId}, falling back to ` +
          `rule-based: ${describe(error)}`,
      );

      // Not wrapped in its own try/catch: if the fallback fails too there is no
      // third engine, and swallowing that would hide a real defect behind an
      // empty list.
      return this.ruleBased.recommend(input);
    }
  }

  /**
   * One `recommendation_log` row per recommended booth. `score` becomes a
   * `Prisma.Decimal` exactly here and nowhere earlier — it is a ranking number
   * everywhere else (see `RecommendedBooth`), and the column is `Decimal(5,2)`.
   *
   * `source` is copied off each booth rather than read from configuration, so a
   * row that says `AI_GEMINI` really came from Gemini and a fallback row says
   * `RULE_BASED`. Telling them apart later is the entire point of the column.
   */
  private async record(
    input: ZoneRecommendationInput,
    booths: RecommendedBooth[],
  ): Promise<void> {
    if (booths.length === 0) {
      return;
    }

    try {
      await this.prisma.recommendationLog.createMany({
        data: booths.map((booth) => ({
          vendorUserId: input.vendorUserId,
          eventId: input.eventId,
          recommendedBoothId: booth.boothId,
          source: booth.source,
          reason: booth.reason,
          score: new Prisma.Decimal(booth.score),
        })),
      });
    } catch (error) {
      // The log is analytics, not part of the answer. A vendor who asked for a
      // suggestion still gets one when the write fails.
      this.logger.warn(
        `Failed to write recommendation_log for event ${input.eventId}: ` +
          describe(error),
      );
    }
  }
}

/**
 * Rejects once `ms` has passed. The losing promise stays subscribed through
 * `Promise.race`, so a late rejection is still handled rather than surfacing as
 * an unhandled rejection.
 */
async function withTimeout<T>(work: Promise<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined;

  try {
    return await Promise.race([
      work,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(
          () => reject(new Error(`Recommender timed out after ${ms}ms`)),
          ms,
        );
      }),
    ]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}

/**
 * A provider may be a remote model that answered with prose, a truncated JSON
 * body, or a booth id it invented. Anything that is not exactly the contract is
 * treated as a failure and falls back — a half-parsed recommendation is worse
 * than a plain one.
 */
function isWellFormed(value: unknown): value is RecommendedBooth[] {
  return Array.isArray(value) && value.every(isRecommendedBooth);
}

function isRecommendedBooth(value: unknown): value is RecommendedBooth {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const booth = value as Partial<RecommendedBooth>;

  return (
    typeof booth.boothId === 'string' &&
    booth.boothId.length > 0 &&
    typeof booth.reason === 'string' &&
    typeof booth.score === 'number' &&
    Number.isFinite(booth.score) &&
    // The documented 0–100 range, which is also what keeps `score` inside
    // `Decimal(5,2)` when it is persisted.
    booth.score >= 0 &&
    booth.score <= 100 &&
    (booth.source === RecommendationSource.AI_GEMINI ||
      booth.source === RecommendationSource.RULE_BASED)
  );
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
