import 'reflect-metadata';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import type { TestingModule } from '@nestjs/testing';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaService } from '../prisma/prisma.service';
import { AiModule } from './ai.module';
import { RuleBasedZoneRecommender } from './providers/rule-based-recommender';
import { ZoneRecommendationService } from './zone-recommendation.service';
import { ZONE_RECOMMENDER } from './zone-recommender.interface';
import type { ZoneRecommender } from './zone-recommender.interface';

/**
 * Boots the real module against a controlled environment — the same shape as
 * the SlipsModule suite, because the two modules are deliberately the same
 * shape.
 *
 * `ignoreEnvFile` keeps .env out of it, and ConfigService reads `process.env`
 * ahead of anything else, so the variable is set there rather than through
 * `load()` — which ConfigService would lose to a value a teammate happened to
 * have exported.
 *
 * PrismaService is replaced before it is ever constructed: the real one is a
 * PrismaClient, and building one needs a DATABASE_URL that a unit test has no
 * business requiring. The module wiring is what is under test here.
 */
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

/** The error a failed boot threw, or undefined if it booted after all. */
async function bootError(): Promise<unknown> {
  return bootAiModule().then(
    () => undefined,
    (thrown: unknown) => thrown,
  );
}

describe('AiModule', () => {
  const original = process.env.ZONE_RECOMMENDER;

  afterEach(() => {
    // Restore rather than delete: whatever the developer had set is theirs.
    if (original === undefined) {
      delete process.env.ZONE_RECOMMENDER;
    } else {
      process.env.ZONE_RECOMMENDER = original;
    }
  });

  it('binds RuleBasedZoneRecommender for ZONE_RECOMMENDER=rule', async () => {
    process.env.ZONE_RECOMMENDER = 'rule';

    const moduleRef = await bootAiModule();

    // `strict: false` because the token is deliberately not exported — see the
    // export test below. Reaching it here is the test looking inside the
    // module, not a pattern for a consumer to copy.
    expect(
      moduleRef.get<ZoneRecommender>(ZONE_RECOMMENDER, { strict: false }),
    ).toBeInstanceOf(RuleBasedZoneRecommender);

    await moduleRef.close();
  });

  it('binds RuleBasedZoneRecommender when ZONE_RECOMMENDER is unset', async () => {
    delete process.env.ZONE_RECOMMENDER;

    const moduleRef = await bootAiModule();

    expect(
      moduleRef.get<ZoneRecommender>(ZONE_RECOMMENDER, { strict: false }),
    ).toBeInstanceOf(RuleBasedZoneRecommender);

    await moduleRef.close();
  });

  /*
   * Not just "a rule-based instance" — the *same* instance the service holds as
   * its fallback. `ZoneRecommendationService.rank` compares the two by identity
   * to decide whether a fallback is worth attempting, so binding a second
   * `new RuleBasedZoneRecommender()` here would make the service run the same
   * failing query twice and swallow the real error the first one raised.
   */
  it('binds the same instance the service falls back to', async () => {
    process.env.ZONE_RECOMMENDER = 'rule';

    const moduleRef = await bootAiModule();

    expect(
      moduleRef.get<ZoneRecommender>(ZONE_RECOMMENDER, { strict: false }),
    ).toBe(moduleRef.get(RuleBasedZoneRecommender, { strict: false }));

    await moduleRef.close();
  });

  // A silent downgrade to the rule-based engine would mean nobody ever notices
  // the AI feature was not switched on: the vendor still gets booths, and the
  // only trace is a `recommendation_log.source` column nobody is reading yet.
  it('refuses to boot for ZONE_RECOMMENDER=gemini, naming the missing ticket', async () => {
    process.env.ZONE_RECOMMENDER = 'gemini';

    const error = await bootError();

    expect(error).toBeInstanceOf(Error);
    const message = (error as Error).message;
    expect(message).toContain('not implemented yet');
    // Whoever hits this needs to know where the work lives, not just that it is
    // missing.
    expect(message).toContain('src/ai/providers/gemini-recommender.ts');
    expect(message).toContain('src/ai/README.md');
    // And a way to keep working today.
    expect(message).toContain('ZONE_RECOMMENDER=rule');
  });

  it('refuses to boot for an unknown ZONE_RECOMMENDER value', async () => {
    process.env.ZONE_RECOMMENDER = 'nonsense';

    const error = await bootError();

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toContain('Unknown ZONE_RECOMMENDER');
  });

  // The token stays internal: a consumer that injected ZONE_RECOMMENDER
  // directly would skip the fallback and skip the `recommendation_log` write.
  it('exports ZoneRecommendationService and keeps the token internal', async () => {
    process.env.ZONE_RECOMMENDER = 'rule';

    const moduleRef = await bootAiModule();

    expect(
      moduleRef.get(ZoneRecommendationService, { strict: false }),
    ).toBeInstanceOf(ZoneRecommendationService);

    const exports: unknown[] =
      (Reflect.getMetadata('exports', AiModule) as unknown[]) ?? [];
    expect(exports).toContain(ZoneRecommendationService);
    expect(exports).not.toContain(ZONE_RECOMMENDER);

    await moduleRef.close();
  });
});
