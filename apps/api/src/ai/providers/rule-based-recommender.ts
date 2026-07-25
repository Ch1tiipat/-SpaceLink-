import { Injectable, NotFoundException } from '@nestjs/common';
import {
  BookingStatus,
  BoothStatus,
  Prisma,
  RecommendationSource,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { DEFAULT_RECOMMENDATION_LIMIT } from '../zone-recommender.interface';
import type {
  RecommendedBooth,
  ZoneRecommendationInput,
  ZoneRecommender,
} from '../zone-recommender.interface';

/**
 * A booking in one of these states holds its booth (AGENTS.md §8, invariant
 * §6.3.3). Anything else — CANCELLED, NO_SHOW, COMPLETED — has released it.
 */
const ACTIVE_BOOKING_STATUSES = [
  BookingStatus.PENDING_PAYMENT,
  BookingStatus.CONFIRMED,
];

/**
 * Score weights. They sum to 100, so every score lands in 0–100 and fits
 * `recommendationLog.score`, which is `Decimal(5,2)`.
 *
 * Category match is weighted highest on purpose: a cheap booth in the wrong
 * zone is a worse recommendation than a pricier booth among the right
 * neighbours.
 */
const CATEGORY_WEIGHT = 70;
const PRICE_WEIGHT = 30;

/** Below this ratio of the median a booth reads as "cheap", above it as "pricey". */
const CHEAP_RATIO = 0.95;
const PRICEY_RATIO = 1.05;

/**
 * What the booth query returns. Declared so the scoring code stays typed, and
 * exported because `candidateBooths` is part of this class's public surface.
 */
export type CandidateBooth = {
  id: string;
  code: string;
  boothPrice: Prisma.Decimal;
  status: BoothStatus;
  zone: {
    code: string;
    name: string | null;
    categories: { categoryId: string; category: { name: string } }[];
  };
  bookings: { status: BookingStatus }[];
};

type ScoredBooth = RecommendedBooth & { boothCode: string };

/**
 * Rule-based booth recommender — the fallback half of
 * `RecommendationSource { AI_GEMINI, RULE_BASED }`.
 *
 * It is not a placeholder for Gemini: it is the engine the product runs on when
 * no API key exists, which is every demo and every teammate's machine. It reads
 * the database and nothing else — no network call, no key, no cost.
 *
 * Ranking, in order of weight:
 *   1. the booth's zone covers the product categories the vendor asked for
 *   2. the booth's price against the median price of the event's free booths
 *
 * The result is fully deterministic: the same database state and the same input
 * always produce the same array, in the same order. Nothing here uses
 * `Math.random`, `Date.now`, or the order rows happen to come back in.
 */
@Injectable()
export class RuleBasedZoneRecommender implements ZoneRecommender {
  constructor(private readonly prisma: PrismaService) {}

  async recommend(input: ZoneRecommendationInput): Promise<RecommendedBooth[]> {
    const limit = input.limit ?? DEFAULT_RECOMMENDATION_LIMIT;
    if (limit <= 0) {
      return [];
    }

    const candidates = await this.candidateBooths(input.eventId);
    const median = medianPrice(candidates.map((booth) => booth.boothPrice));

    const scored = candidates.map((booth) => this.score(booth, input, median));

    scored.sort(compareRecommendations);

    return scored.slice(0, limit).map(({ boothId, score, reason, source }) => ({
      boothId,
      score,
      reason,
      source,
    }));
  }

  /**
   * Every booth that may legitimately be recommended for this event, and
   * nothing else. Throws NotFoundException for an unknown event.
   *
   * Public because `ZoneRecommendationService` checks any provider's answer
   * against this set — a remote model can return a plausible UUID for a booth
   * that does not exist, belongs to another venue, or is already booked, and
   * "recommended" has to mean "bookable" or the vendor is sent to a dead end.
   *
   * It is one method rather than a `where` clause copied into the service on
   * purpose: two definitions of "candidate" would drift, and the half that
   * drifted would be the one deciding what counts as a hallucination.
   */
  async candidateBooths(eventId: string): Promise<CandidateBooth[]> {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      select: { venueId: true },
    });

    if (!event) {
      throw new NotFoundException('Event not found');
    }

    // A booth belongs to an event through zone -> venue: the bookable booths of
    // an event are exactly the booths at the venue the event is held at
    // (invariant §6.3.1).
    const booths: CandidateBooth[] = await this.prisma.booth.findMany({
      where: {
        zone: { venueId: event.venueId },
        status: BoothStatus.AVAILABLE,
        bookings: {
          none: {
            eventId,
            status: { in: ACTIVE_BOOKING_STATUSES },
          },
        },
      },
      select: {
        id: true,
        code: true,
        boothPrice: true,
        status: true,
        zone: {
          select: {
            code: true,
            name: true,
            categories: {
              select: {
                categoryId: true,
                category: { select: { name: true } },
              },
            },
          },
        },
        // Loaded even though the `where` above already excludes these rows —
        // see `isFree`.
        bookings: {
          where: {
            eventId,
            status: { in: ACTIVE_BOOKING_STATUSES },
          },
          select: { status: true },
        },
      },
    });

    return dedupeById(booths.filter(isFree));
  }

  private score(
    booth: CandidateBooth,
    input: ZoneRecommendationInput,
    median: Prisma.Decimal | null,
  ): ScoredBooth {
    // Kept in the caller's order, so the reason string lists categories the way
    // the vendor listed them rather than the way Postgres returned the rows.
    const zoneCategoryIds = new Set(
      booth.zone.categories.map((link) => link.categoryId),
    );
    const requestedIds = [...new Set(input.productCategoryIds)];
    const matchedIds = requestedIds.filter((id) => zoneCategoryIds.has(id));
    const matchedNames = matchedIds.map((id) => categoryName(booth, id));

    const categoryScore =
      requestedIds.length === 0
        ? 0
        : (CATEGORY_WEIGHT * matchedIds.length) / requestedIds.length;

    // `ratio` is dimensionless — a price divided by a price — so it is a plain
    // number by the time it leaves this line. The division itself is done in
    // `Decimal` (AGENTS.md §6.1): no money value is ever put through a float.
    const ratio =
      median === null || median.isZero()
        ? 1
        : booth.boothPrice.div(median).toNumber();

    // Cheaper is better, linearly: half the median scores 22.5, the median
    // scores 15, twice the median scores 0.
    const priceScore = clamp((PRICE_WEIGHT * (2 - ratio)) / 2, 0, PRICE_WEIGHT);

    return {
      boothId: booth.id,
      boothCode: booth.code,
      // Two decimals: it keeps the score exactly representable in
      // `Decimal(5,2)`, and it makes genuine ties compare as ties rather than
      // as a float difference in the fifteenth decimal place.
      score: roundToTwo(categoryScore + priceScore),
      reason: buildReason(booth, requestedIds, matchedNames, median, ratio),
      source: RecommendationSource.RULE_BASED,
    };
  }
}

/**
 * Invariant §6.3.3 — one active booking per (event, booth) — decided here in
 * TypeScript rather than only in the `where` clause above.
 *
 * The duplication is deliberate. This is the code path the demo falls back to,
 * and its unit tests run against a mocked PrismaService: an exclusion that
 * exists only inside a Prisma `where` cannot be proven without a live database.
 * Keeping the decision in code makes it testable, and keeps a later edit to the
 * query from quietly recommending a booth somebody has already paid for.
 */
function isFree(booth: CandidateBooth): boolean {
  return booth.status === BoothStatus.AVAILABLE && booth.bookings.length === 0;
}

/**
 * One entry per booth, for the same reason `isFree` is duplicated above: the
 * property belongs to the code, not to the shape of the current query.
 *
 * `findMany` selecting by primary key cannot return a booth twice today, so
 * this is a no-op against the query as written. It stops being one the moment
 * somebody adds a `where` that fans out over a to-many relation — and the cost
 * of missing that is not just a repeated card in the UI: a duplicated price
 * would drag the median, and every other booth's score with it.
 */
function dedupeById(booths: CandidateBooth[]): CandidateBooth[] {
  const seen = new Set<string>();

  return booths.filter((booth) => {
    if (seen.has(booth.id)) {
      return false;
    }

    seen.add(booth.id);
    return true;
  });
}

/**
 * Median of the candidate prices, in `Decimal` throughout — this is money.
 * Returns null when there is nothing to take a median of.
 */
function medianPrice(prices: Prisma.Decimal[]): Prisma.Decimal | null {
  if (prices.length === 0) {
    return null;
  }

  const sorted = [...prices].sort((a, b) => a.comparedTo(b));
  const middle = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 1) {
    return sorted[middle];
  }

  return sorted[middle - 1].plus(sorted[middle]).div(2);
}

/**
 * Best first, then a total order on ties.
 *
 * Booth codes are unique per zone, not per venue, so two zones may each hold an
 * `A01`; the id breaks that last tie. Without it the order of two equal booths
 * would depend on the order Postgres returned them in, and the same request
 * could answer differently twice.
 */
function compareRecommendations(a: ScoredBooth, b: ScoredBooth): number {
  const byScore = b.score - a.score;
  if (byScore !== 0) {
    return byScore;
  }

  return (
    compareStrings(a.boothCode, b.boothCode) ||
    compareStrings(a.boothId, b.boothId)
  );
}

/**
 * Plain code-unit comparison, not `localeCompare`: collation depends on the
 * host's locale data, and this order has to be identical on a teammate's
 * machine, on Railway, and in CI.
 */
function compareStrings(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

/**
 * The Thai sentence shown next to the booth in the vendor UI. It names the
 * actual grounds this booth scored what it did — zone, category match, and how
 * its price sits against the event median — so a vendor can disagree with it.
 */
function buildReason(
  booth: CandidateBooth,
  requestedIds: string[],
  matchedNames: string[],
  median: Prisma.Decimal | null,
  ratio: number,
): string {
  const zoneLabel = booth.zone.name
    ? `โซน ${booth.zone.code} (${booth.zone.name})`
    : `โซน ${booth.zone.code}`;

  const parts = [zoneLabel, categoryReason(requestedIds, matchedNames)];

  if (median !== null) {
    parts.push(priceReason(booth.boothPrice, median, ratio));
  }

  return parts.join(' · ');
}

function categoryReason(
  requestedIds: string[],
  matchedNames: string[],
): string {
  if (requestedIds.length === 0) {
    return 'ไม่ได้ระบุหมวดสินค้า จึงจัดอันดับจากราคาเป็นหลัก';
  }

  if (matchedNames.length === 0) {
    return 'ไม่ตรงกับหมวดสินค้าที่เลือก';
  }

  const names = matchedNames.join(', ');

  return matchedNames.length === requestedIds.length
    ? `ตรงกับหมวดสินค้าที่เลือกทั้งหมด (${names})`
    : `ตรงกับหมวดสินค้าที่เลือกบางส่วน (${names})`;
}

/**
 * `toFixed` comes from `Decimal`, so the baht figures in this sentence are the
 * stored values printed exactly — never a float round-trip (AGENTS.md §6.1).
 */
function priceReason(
  price: Prisma.Decimal,
  median: Prisma.Decimal,
  ratio: number,
): string {
  const shown = `ราคา ${price.toFixed(2)} บาท`;
  const compared = `ค่ากลางของงาน (${median.toFixed(2)} บาท)`;

  if (ratio < CHEAP_RATIO) {
    return `${shown} ต่ำกว่า${compared}`;
  }

  if (ratio > PRICEY_RATIO) {
    return `${shown} สูงกว่า${compared}`;
  }

  return `${shown} ใกล้เคียง${compared}`;
}

function categoryName(booth: CandidateBooth, categoryId: string): string {
  const link = booth.zone.categories.find(
    (candidate) => candidate.categoryId === categoryId,
  );

  return link ? link.category.name : categoryId;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function roundToTwo(value: number): number {
  return Math.round(value * 100) / 100;
}
