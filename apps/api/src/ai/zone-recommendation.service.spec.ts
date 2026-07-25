import { Logger, NotFoundException } from '@nestjs/common';
import { Prisma, RecommendationSource } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RuleBasedZoneRecommender } from './providers/rule-based-recommender';
import { ZoneRecommendationService } from './zone-recommendation.service';
import type {
  RecommendedBooth,
  ZoneRecommendationInput,
  ZoneRecommender,
} from './zone-recommender.interface';

const EVENT_ID = '11111111-1111-4111-8111-111111111111';
const VENDOR_ID = '33333333-3333-4333-8333-333333333333';

const INPUT: ZoneRecommendationInput = {
  eventId: EVENT_ID,
  vendorUserId: VENDOR_ID,
  productCategoryIds: ['category-food'],
};

const GEMINI_RESULT: RecommendedBooth[] = [
  {
    boothId: 'booth-A01',
    score: 92.5,
    reason: 'อยู่ใกล้ทางเข้าและตรงกับหมวดสินค้าที่เลือก',
    source: RecommendationSource.AI_GEMINI,
  },
];

const RULE_RESULT: RecommendedBooth[] = [
  {
    boothId: 'booth-B01',
    score: 85,
    reason: 'โซน Z1 · ตรงกับหมวดสินค้าที่เลือกทั้งหมด (อาหาร)',
    source: RecommendationSource.RULE_BASED,
  },
  {
    boothId: 'booth-B02',
    score: 70.25,
    reason: 'โซน Z2 · ไม่ตรงกับหมวดสินค้าที่เลือก',
    source: RecommendationSource.RULE_BASED,
  },
];

/** The `recommendation_log` rows the service is expected to build. */
type LoggedRow = {
  vendorUserId: string;
  eventId: string;
  recommendedBoothId: string;
  source: RecommendationSource;
  reason: string;
  score: Prisma.Decimal;
};

function loggedRows(createMany: jest.Mock): LoggedRow[] {
  const [args] = createMany.mock.calls[0] as [{ data: LoggedRow[] }];

  return args.data;
}

describe('ZoneRecommendationService', () => {
  let prisma: { recommendationLog: { createMany: jest.Mock } };
  let configured: { recommend: jest.Mock };
  let ruleBased: { recommend: jest.Mock };
  let warn: jest.SpyInstance;

  function createService(
    provider: ZoneRecommender = configured,
  ): ZoneRecommendationService {
    return new ZoneRecommendationService(
      provider,
      ruleBased as unknown as RuleBasedZoneRecommender,
      prisma as unknown as PrismaService,
    );
  }

  beforeEach(() => {
    prisma = { recommendationLog: { createMany: jest.fn() } };
    configured = { recommend: jest.fn().mockResolvedValue(GEMINI_RESULT) };
    ruleBased = { recommend: jest.fn().mockResolvedValue(RULE_RESULT) };
    warn = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    warn.mockRestore();
  });

  it('returns the configured provider result and logs it with its own source', async () => {
    const result = await createService().recommend(INPUT);

    expect(result).toEqual(GEMINI_RESULT);
    expect(ruleBased.recommend).not.toHaveBeenCalled();

    const rows = loggedRows(prisma.recommendationLog.createMany);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({
      vendorUserId: VENDOR_ID,
      eventId: EVENT_ID,
      recommendedBoothId: 'booth-A01',
      source: RecommendationSource.AI_GEMINI,
      reason: GEMINI_RESULT[0].reason,
      score: new Prisma.Decimal('92.5'),
    });
    // score is a ranking number everywhere except here.
    expect(rows[0].score).toBeInstanceOf(Prisma.Decimal);
  });

  // The vendor never learns the AI failed — they just get the rule-based answer.
  it('falls back to rule-based when the configured provider throws', async () => {
    configured.recommend.mockRejectedValue(new Error('gemini exploded'));

    const result = await createService().recommend(INPUT);

    expect(result).toEqual(RULE_RESULT);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('falling back to rule-based') as string,
    );

    const rows = loggedRows(prisma.recommendationLog.createMany);
    expect(rows.map((row) => row.source)).toEqual([
      RecommendationSource.RULE_BASED,
      RecommendationSource.RULE_BASED,
    ]);
  });

  it('falls back when the configured provider returns a malformed result', async () => {
    configured.recommend.mockResolvedValue([
      { boothId: 'booth-A01', score: 'สูงมาก', source: 'MAGIC' },
    ]);

    const result = await createService().recommend(INPUT);

    expect(result).toEqual(RULE_RESULT);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('malformed') as string,
    );
  });

  it('writes one recommendation_log row per returned booth', async () => {
    configured.recommend.mockRejectedValue(new Error('gemini exploded'));

    const result = await createService().recommend(INPUT);

    const rows = loggedRows(prisma.recommendationLog.createMany);
    expect(rows).toHaveLength(result.length);
    expect(rows.map((row) => row.recommendedBoothId)).toEqual(
      result.map((booth) => booth.boothId),
    );
    expect(rows.map((row) => row.score.toString())).toEqual(['85', '70.25']);
  });

  it('does not write a log row when nothing was recommended', async () => {
    configured.recommend.mockResolvedValue([]);

    await expect(createService().recommend(INPUT)).resolves.toEqual([]);

    expect(prisma.recommendationLog.createMany).not.toHaveBeenCalled();
  });

  // The log is analytics. Losing it must not cost the vendor their answer.
  it('still returns recommendations when the log write fails', async () => {
    prisma.recommendationLog.createMany.mockRejectedValue(
      new Error('database unreachable'),
    );

    await expect(createService().recommend(INPUT)).resolves.toEqual(
      GEMINI_RESULT,
    );

    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('Failed to write recommendation_log') as string,
    );
  });

  /*
   * Fallback covers a failure of the *configured* provider, and nothing else.
   * An error from the rule-based engine is not a degraded AI — it is the
   * database engine failing, and there is no third engine behind it.
   *
   * So a 404 for an unknown event must reach the caller as a 404. Swallowing it
   * into `[]` would tell a vendor the event simply has no free booths, which is
   * a different and false statement.
   */
  it('propagates a fallback failure instead of swallowing it into an empty list', async () => {
    configured.recommend.mockRejectedValue(new Error('gemini exploded'));
    ruleBased.recommend.mockRejectedValue(
      new NotFoundException('Event not found'),
    );

    await expect(createService().recommend(INPUT)).rejects.toBeInstanceOf(
      NotFoundException,
    );

    // The configured provider's failure was still logged and still triggered
    // the fallback — it is only the fallback's own error that gets out.
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('falling back to rule-based') as string,
    );
    expect(ruleBased.recommend).toHaveBeenCalledTimes(1);
    // Nothing was recommended, so nothing may be logged as recommended.
    expect(prisma.recommendationLog.createMany).not.toHaveBeenCalled();
  });

  // With ZONE_RECOMMENDER=rule the configured provider IS the fallback, so
  // retrying it would just repeat the same failing query.
  it('does not retry itself when the rule-based engine is the configured provider', async () => {
    ruleBased.recommend.mockRejectedValue(new Error('event not found'));

    await expect(
      createService(ruleBased as unknown as ZoneRecommender).recommend(INPUT),
    ).rejects.toThrow('event not found');

    expect(ruleBased.recommend).toHaveBeenCalledTimes(1);
    expect(prisma.recommendationLog.createMany).not.toHaveBeenCalled();
  });
});
