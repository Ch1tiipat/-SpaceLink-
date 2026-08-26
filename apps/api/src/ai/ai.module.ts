import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { GeminiZoneRecommender } from './providers/gemini-recommender';
import { RuleBasedZoneRecommender } from './providers/rule-based-recommender';
import { ZoneRecommendationService } from './zone-recommendation.service';
import { ZONE_RECOMMENDER } from './zone-recommender.interface';
import type { ZoneRecommender } from './zone-recommender.interface';
import { RecommendationsController } from './recommendations.controller';
import { SupportAssistantController } from './support-assistant.controller';
import { SupportAssistantService } from './support-assistant.service';

type ZoneRecommenderName = 'rule' | 'gemini';

@Module({
  controllers: [RecommendationsController, SupportAssistantController],
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
    SupportAssistantService,
  ],
  exports: [ZoneRecommendationService],
})
export class AiModule {}
