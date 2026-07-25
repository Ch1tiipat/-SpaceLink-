import { RecommendationSource } from '@prisma/client';

/**
 * DI token for the zone recommender. An interface disappears at compile time,
 * so Nest needs a runtime token to inject against — hence a Symbol rather than
 * a class. Inject with `@Inject(ZONE_RECOMMENDER)`.
 */
export const ZONE_RECOMMENDER = Symbol('ZONE_RECOMMENDER');

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

  /** How many booths to return. Defaults to 5 when omitted. */
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
 * The returned array is ordered best-first and is at most `limit` long. An
 * event with no free booth returns an empty array — that is a normal answer,
 * not an error.
 */
export interface ZoneRecommender {
  recommend(input: ZoneRecommendationInput): Promise<RecommendedBooth[]>;
}
