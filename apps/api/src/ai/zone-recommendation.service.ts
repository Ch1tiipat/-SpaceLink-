import { Inject, Injectable, Logger } from '@nestjs/common';
import { Prisma, RecommendationSource } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RuleBasedZoneRecommender } from './providers/rule-based-recommender';
import {
  DEFAULT_RECOMMENDATION_LIMIT,
  ZONE_RECOMMENDER,
} from './zone-recommender.interface';
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
 *   1. **Fallback.** If the configured provider throws, times out, returns
 *      something malformed, or names a booth that is not bookable at this
 *      event, the rule-based engine answers instead. The caller never sees the
 *      failure — from the outside the feature either works or is quietly a
 *      little less clever (AGENTS.md §4).
 *   2. **The result contract.** Whatever the provider hands back, the caller
 *      gets each `boothId` at most once and no more than `limit` of them
 *      (`ZoneRecommender`). Enforced here rather than trusted, because a
 *      remote model that repeats a booth or ignores `limit` is a likely
 *      failure and the log rows are written from this array.
 *   3. **Persistence.** Every returned booth is written to `recommendation_log`
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
    // Trimmed before `record`, not after: the answer and the log rows are the
    // same array, so a booth the vendor never saw can never be logged as
    // recommended to them.
    const booths = enforceResultContract(await this.rank(input), input.limit);

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

      await this.assertBookable(input.eventId, booths);

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
   * Every recommended booth must be one the vendor could actually book at this
   * event — the set `RuleBasedZoneRecommender.candidateBooths` defines.
   *
   * A well-formed answer is not a true one. A remote model can return a
   * perfectly shaped `RecommendedBooth` carrying a booth id it invented, one
   * from another venue, or one somebody else has already booked. Every step
   * after this treats the array as fact: the vendor is shown the booth, and the
   * id goes into `recommendation_log`, where it is a foreign key. Left
   * unchecked, the first thing to notice is a P2003 inside the log write — which
   * `record` deliberately swallows, because a failed analytics write must not
   * cost a vendor their answer. The vendor is then holding a booth id that
   * cannot be booked and nothing anywhere says so.
   *
   * The whole answer is discarded, not the bad entries: one invented booth means
   * the model was inventing, and the rest of that ranking has not earned any
   * more trust than the part that was caught.
   *
   * Runs only on the configured provider's result. The rule-based engine returns
   * booths it queried from this same set, so validating its output would be a
   * round trip to confirm a tautology.
   */
  private async assertBookable(
    eventId: string,
    booths: RecommendedBooth[],
  ): Promise<void> {
    if (booths.length === 0) {
      return;
    }

    const candidates = await this.ruleBased.candidateBooths(eventId);
    const bookable = new Set(candidates.map((booth) => booth.id));
    const unknown = booths.filter((booth) => !bookable.has(booth.boothId));

    if (unknown.length > 0) {
      // Count, not the ids themselves: a hallucinating model can return an
      // arbitrary number of them, and this line goes to a shared log.
      throw new Error(
        `Recommender returned ${unknown.length} of ${booths.length} booth(s) ` +
          'that are not bookable at this event',
      );
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
 * The two properties of the returned array that `ZoneRecommender` promises but
 * a provider cannot be trusted to deliver: each booth appears once, and there
 * are at most `limit` of them.
 *
 * Deliberately not a fallback trigger. A repeated booth or an over-long array
 * is a usable answer with something extra in it, unlike a malformed entry
 * (`isWellFormed`), which has nothing to salvage. Trimming keeps the ranking
 * the provider produced; falling back would throw away a good ranking over a
 * cosmetic fault.
 *
 * The first occurrence wins, so the highest-ranked copy of a duplicated booth
 * is the one kept — the array is already ordered best-first.
 */
function enforceResultContract(
  booths: RecommendedBooth[],
  limit: number | undefined,
): RecommendedBooth[] {
  const seen = new Set<string>();
  const unique: RecommendedBooth[] = [];

  for (const booth of booths) {
    if (seen.has(booth.boothId)) {
      continue;
    }

    seen.add(booth.boothId);
    unique.push(booth);
  }

  return unique.slice(0, boundedLimit(limit));
}

/**
 * `limit` reaches here from a caller, so it is treated as untrusted input.
 * Anything not a usable positive count means zero booths — never "all of
 * them", and never a negative that `slice` would read as an offset from the
 * end.
 */
function boundedLimit(limit: number | undefined): number {
  if (limit === undefined) {
    return DEFAULT_RECOMMENDATION_LIMIT;
  }

  if (!Number.isFinite(limit) || limit <= 0) {
    return 0;
  }

  return Math.floor(limit);
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
