import { Injectable } from '@nestjs/common';
import type {
  RecommendedBooth,
  ZoneRecommendationInput,
  ZoneRecommender,
} from '../zone-recommender.interface';

/**
 * Gemini-backed recommender. **Not implemented — a separate ticket.** Nothing
 * here calls Gemini, and `ai.module.ts` refuses to boot with
 * `ZONE_RECOMMENDER=gemini` so this class can never be reached by accident.
 *
 * This is a **pure adapter**: prompt Gemini, map the answer onto
 * `RecommendedBooth[]`, return it. It does not persist anything, it does not
 * fall back, and it must never inject another recommender.
 * `ZoneRecommendationService` owns both of those — on any error, timeout, or
 * malformed answer it logs the failure and serves the rule-based result
 * instead, so **the right thing to do here is simply to throw**.
 *
 * Requirements for whoever picks that ticket up:
 *
 * - **Flash or Flash-Lite only. The Pro tier is forbidden** (AGENTS.md §4) —
 *   it is a cost-control rule, not a preference.
 * - Return `source: RecommendationSource.AI_GEMINI` on every booth. The service
 *   copies it straight into `recommendation_log`, so claiming a source this
 *   engine did not produce makes the column a lie.
 * - Keep to the contract: a real booth id from this event, a `score` in 0–100,
 *   and a Thai `reason`. The service validates the shape and discards the whole
 *   answer if any of it is off, so a sloppy mapping shows up as the feature
 *   silently never using Gemini.
 * - Send no personal data in the prompt. Booth codes, zone names, prices, and
 *   category names are enough — no vendor name, email, phone, or slip content
 *   (AGENTS.md §14.5).
 * - Do not change `ZoneRecommender`. The booking code will already depend on
 *   it; talk to the team first if the signature genuinely cannot hold.
 */
@Injectable()
export class GeminiZoneRecommender implements ZoneRecommender {
  constructor() {
    // A plain Error at construction time, matching how ai.module.ts and
    // slips.module.ts report an unimplemented provider. It used to be a
    // NotImplementedException thrown from `recommend`, which is HTTP 501 — a
    // status a vendor would have seen, describing an unwritten ticket as if it
    // were an answer to their request. Registering this class anywhere now
    // stops the server at boot instead, where a missing implementation belongs.
    throw new Error(
      'ZONE_RECOMMENDER=gemini is not implemented yet. The real client ' +
        '(src/ai/providers/gemini-recommender.ts) is a separate ticket — see ' +
        'src/ai/README.md. Use ZONE_RECOMMENDER=rule.',
    );
  }

  recommend(input: ZoneRecommendationInput): Promise<RecommendedBooth[]> {
    void input;

    // Unreachable — the constructor never returns. Present only because
    // `ZoneRecommender` requires it.
    throw new Error(
      'GeminiZoneRecommender is not implemented yet — see src/ai/README.md.',
    );
  }
}
