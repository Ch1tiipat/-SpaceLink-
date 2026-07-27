import 'reflect-metadata';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import type { TestingModule } from '@nestjs/testing';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaService } from '../prisma/prisma.service';
import { AiModule } from './ai.module';
import { GeminiZoneRecommender } from './providers/gemini-recommender';
import { RuleBasedZoneRecommender } from './providers/rule-based-recommender';
import { ZoneRecommendationService } from './zone-recommendation.service';
import { ZONE_RECOMMENDER } from './zone-recommender.interface';
import type { ZoneRecommender } from './zone-recommender.interface';

function bootAiModule(): Promise<TestingModule> {
  return Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }),
      PrismaModule,
      AiModule,
    ],
  })
    .overrideProvider(PrismaService)
    .useValue({})
    .compile();
}

describe('AiModule', () => {
  const original = {
    ZONE_RECOMMENDER: process.env.ZONE_RECOMMENDER,
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    GEMINI_MODEL: process.env.GEMINI_MODEL,
  };

  afterEach(() => {
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it('binds the same rule-based instance used for fallback', async () => {
    process.env.ZONE_RECOMMENDER = 'rule';
    const moduleRef = await bootAiModule();

    expect(
      moduleRef.get<ZoneRecommender>(ZONE_RECOMMENDER, { strict: false }),
    ).toBe(moduleRef.get(RuleBasedZoneRecommender, { strict: false }));
    await moduleRef.close();
  });

  it('binds Gemini Flash when configured', async () => {
    process.env.ZONE_RECOMMENDER = 'gemini';
    process.env.GEMINI_API_KEY = 'key';
    process.env.GEMINI_MODEL = 'gemini-2.5-flash-lite';

    const moduleRef = await bootAiModule();

    expect(
      moduleRef.get<ZoneRecommender>(ZONE_RECOMMENDER, { strict: false }),
    ).toBeInstanceOf(GeminiZoneRecommender);
    await moduleRef.close();
  });

  it('fails clearly when the Gemini key is absent', async () => {
    process.env.ZONE_RECOMMENDER = 'gemini';
    delete process.env.GEMINI_API_KEY;

    await expect(bootAiModule()).rejects.toThrow('GEMINI_API_KEY');
  });

  it('exports the fallback/logging service and keeps the token internal', async () => {
    process.env.ZONE_RECOMMENDER = 'rule';
    const moduleRef = await bootAiModule();
    const exports: unknown[] =
      (Reflect.getMetadata('exports', AiModule) as unknown[]) ?? [];

    expect(
      moduleRef.get(ZoneRecommendationService, { strict: false }),
    ).toBeInstanceOf(ZoneRecommendationService);
    expect(exports).toContain(ZoneRecommendationService);
    expect(exports).not.toContain(ZONE_RECOMMENDER);
    await moduleRef.close();
  });
});
