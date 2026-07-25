import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RuleBasedZoneRecommender } from './providers/rule-based-recommender';
import { ZoneRecommendationService } from './zone-recommendation.service';
import { ZONE_RECOMMENDER } from './zone-recommender.interface';
import type { ZoneRecommender } from './zone-recommender.interface';

/** Values accepted by ZONE_RECOMMENDER. */
type ZoneRecommenderName = 'rule' | 'gemini';

/**
 * Binds one implementation to the ZONE_RECOMMENDER token, chosen by the
 * ZONE_RECOMMENDER environment variable.
 *
 * The factory runs at boot, so an unusable configuration stops the server
 * immediately instead of failing on the first vendor who asks for a suggestion.
 *
 * Only `ZoneRecommendationService` is exported. The token and the providers
 * stay internal on purpose: reaching past the service would skip the fallback
 * and skip the `recommendation_log` write.
 *
 * `RuleBasedZoneRecommender` is registered as a class provider and handed to the
 * factory rather than constructed inside it, so `ZONE_RECOMMENDER=rule` binds
 * the *same instance* the service holds as its fallback — that identity is what
 * lets the service skip a pointless second attempt against itself.
 */
@Module({
  providers: [
    RuleBasedZoneRecommender,
    {
      provide: ZONE_RECOMMENDER,
      inject: [ConfigService, RuleBasedZoneRecommender],
      useFactory: (
        config: ConfigService,
        ruleBased: RuleBasedZoneRecommender,
      ): ZoneRecommender => {
        const name =
          config.get<ZoneRecommenderName>('ZONE_RECOMMENDER') ?? 'rule';

        switch (name) {
          case 'rule':
            return ruleBased;

          case 'gemini':
            // Deliberate: ZONE_RECOMMENDER=gemini must not silently downgrade
            // to the rule-based engine, or nobody would notice the AI feature
            // was never switched on. This is a misconfiguration, not the
            // runtime fallback the service performs.
            throw new Error(
              'ZONE_RECOMMENDER=gemini is not implemented yet. The real client ' +
                '(src/ai/providers/gemini-recommender.ts) is a separate ticket ' +
                '— see src/ai/README.md. Use ZONE_RECOMMENDER=rule.',
            );

          default:
            throw new Error(
              `Unknown ZONE_RECOMMENDER "${String(name)}". Valid values: rule, ` +
                'gemini.',
            );
        }
      },
    },
    ZoneRecommendationService,
  ],
  exports: [ZoneRecommendationService],
})
export class AiModule {}
