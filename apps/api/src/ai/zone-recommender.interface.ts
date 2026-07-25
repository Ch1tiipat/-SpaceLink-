import { RecommendationSource } from '@prisma/client';

/**
 * DI token for the zone recommender. An interface disappears at compile time,
 * so Nest needs a runtime token to inject against — hence a Symbol rather than
 * a class. Inject with `@Inject(ZONE_RECOMMENDER)`.
 */
export const ZONE_RECOMMENDER = Symbol('ZONE_RECOMMENDER');

/**
 * How many booths a recommender returns when the caller passes no `limit`.
 * Lives here rather than in a provider because it is part of the contract every
 * implementation answers to.
 */
export const DEFAULT_RECOMMENDATION_LIMIT = 5;

/** What the caller hands a recommender. */
export interface ZoneRecommendationInput {
  /** The event to recommend booths in. Only booths at this event's venue count. */
  eventId: string;

  /**
   * `app_user.id` of the vendor asking. Persisted as
   * `recommendationLog.vendorUserId` by the caller.
   */
  vendorUserId: string;

  /**
   * `productCategory.id[]` the vendor sells — normally the categories on their
   * Shop. Matched against `ZoneCategory`. An empty array is legal: it means the
   * vendor gave no signal, and ranking falls back to price alone.
   */
  productCategoryIds: string[];

  /**
   * How many booths to return. Defaults to `DEFAULT_RECOMMENDATION_LIMIT` when
   * omitted. Zero or negative means zero booths, never "all of them".
   */
  limit?: number;
}

/**
 * One recommended booth.
 *
 * `score` is deliberately a plain `number`, and AGENTS.md §6.1 (money is
 * `Decimal`, never `number`) does NOT apply to it. It is a ranking score, not
 * money: it is never summed, never compared for exact equality, and never
 * displayed as a price. Its only job is to order this array.
 *
 * The one place it becomes a `Decimal` is when the caller writes
 * `recommendationLog.score`, which is `Decimal(5,2)` — convert there with
 * `new Prisma.Decimal(score)`, not here. Providers keep scores in the range
 * 0–100 with at most two decimals so that conversion is always exact.
 */
export interface RecommendedBooth {
  /**
   * A booth the vendor can actually book at this event — at the event's venue,
   * AVAILABLE, and not already held by an active booking.
   *
   * `ZoneRecommendationService` checks every id against that set and throws the
   * whole answer away if any one of them is not in it. Return an id you were
   * not given and your recommendations silently never reach a vendor, so build
   * this from the booths you were handed rather than from anything a model
   * wrote.
   */
  boothId: string;

  /** Ranking score, higher is better. See the note above — this is not money. */
  score: number;

  /**
   * Why this booth was recommended, **in Thai** — it is rendered in the vendor
   * UI as-is and persisted as `recommendationLog.reason`. It must state the
   * actual reason this booth ranked where it did, not a generic sentence.
   */
  reason: string;

  /** Which engine produced this. Persisted as `recommendationLog.source`. */
  source: RecommendationSource;
}

/**
 * The socket a Gemini-backed recommender plugs into. Consumers depend on this
 * interface only, so swapping rule → gemini is an env-var change and touches no
 * calling code.
 *
 * The returned array is ordered best-first, holds each `boothId` at most once,
 * and is at most `limit` long. An event with no free booth returns an empty
 * array — that is a normal answer, not an error.
 *
 * Implement those three properties anyway, but do not rely on being the only
 * thing that does: `ZoneRecommendationService` re-applies the dedupe and the
 * limit to whatever comes back. A remote model that repeats a booth or ignores
 * `limit` is a likely failure, and it must not reach the vendor or turn into
 * extra `recommendation_log` rows.
 */
export interface ZoneRecommender {
  recommend(input: ZoneRecommendationInput): Promise<RecommendedBooth[]>;
}
