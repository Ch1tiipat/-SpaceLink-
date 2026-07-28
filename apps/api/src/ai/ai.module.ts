import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { GeminiZoneRecommender } from './providers/gemini-recommender';
import { RuleBasedZoneRecommender } from './providers/rule-based-recommender';
import { ZoneRecommendationService } from './zone-recommendation.service';
import { ZONE_RECOMMENDER } from './zone-recommender.interface';
import type { ZoneRecommender } from './zone-recommender.interface';

type ZoneRecommenderName = 'rule' | 'gemini';

@Module({
  providers: [
    RuleBasedZoneRecommender,
    {
      provide: ZONE_RECOMMENDER,
      inject: [ConfigService, RuleBasedZoneRecommender, PrismaService],
      useFactory: (
        config: ConfigService,
        ruleBased: RuleBasedZoneRecommender,
        prisma: PrismaService,
      ): ZoneRecommender => {
        const name =
          config.get<ZoneRecommenderName>('ZONE_RECOMMENDER') ?? 'rule';

        switch (name) {
          case 'rule':
            return ruleBased;
          case 'gemini':
            return new GeminiZoneRecommender(config, prisma);
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
