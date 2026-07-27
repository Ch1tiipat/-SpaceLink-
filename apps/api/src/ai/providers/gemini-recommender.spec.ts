import { ConfigService } from '@nestjs/config';
import { BoothStatus, Prisma, RecommendationSource } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { GeminiZoneRecommender } from './gemini-recommender';

const findUnique = jest.fn();
const findMany = jest.fn();
const prisma = {
  event: { findUnique },
  booth: { findMany },
} as unknown as PrismaService;

function recommender(model = 'gemini-2.5-flash-lite') {
  return new GeminiZoneRecommender(
    new ConfigService({
      GEMINI_API_KEY: 'gemini-secret',
      GEMINI_MODEL: model,
    }),
    prisma,
  );
}

function candidateRows() {
  return [
    {
      id: 'booth-a1',
      code: 'A01',
      boothPrice: new Prisma.Decimal('1500'),
      status: BoothStatus.AVAILABLE,
      zone: {
        code: 'A',
        name: 'โซนอาหาร',
        categories: [{ category: { id: 'food-category', name: 'อาหาร' } }],
      },
    },
  ];
}

function response(text: string): Response {
  return new Response(
    JSON.stringify({
      candidates: [{ content: { parts: [{ text }] } }],
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
}

describe('GeminiZoneRecommender', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    findUnique.mockResolvedValue({ venueId: 'venue-1' });
    findMany.mockResolvedValue(candidateRows());
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns validated AI_GEMINI recommendations from candidate booths', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue(
      response(
        JSON.stringify([
          {
            boothId: 'booth-a1',
            score: 94.126,
            reason: 'อยู่ในโซนอาหารและราคาเหมาะกับร้าน',
          },
        ]),
      ),
    );

    const result = await recommender().recommend({
      eventId: 'event-1',
      vendorUserId: 'private-user-id',
      productCategoryIds: ['food-category'],
      limit: 3,
    });

    expect(result).toEqual([
      {
        boothId: 'booth-a1',
        score: 94.13,
        reason: 'อยู่ในโซนอาหารและราคาเหมาะกับร้าน',
        source: RecommendationSource.AI_GEMINI,
      },
    ]);

    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent',
    );
    expect((init?.headers as Record<string, string>)['x-goog-api-key']).toBe(
      'gemini-secret',
    );
    const body = init?.body as string;
    expect(body).toContain('booth-a1');
    expect(body).toContain('food-category');
    expect(body).not.toContain('private-user-id');
  });

  it('rejects a booth that was not in the candidate list', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(
      response(
        JSON.stringify([
          {
            boothId: 'invented-booth',
            score: 99,
            reason: 'ข้อมูลที่โมเดลสร้างขึ้น',
          },
        ]),
      ),
    );

    await expect(
      recommender().recommend({
        eventId: 'event-1',
        vendorUserId: 'vendor-1',
        productCategoryIds: [],
      }),
    ).rejects.toThrow('outside the candidate list');
  });

  it('rejects malformed model output so the service can fall back', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(response('not valid json'));

    await expect(
      recommender().recommend({
        eventId: 'event-1',
        vendorUserId: 'vendor-1',
        productCategoryIds: [],
      }),
    ).rejects.toThrow('invalid JSON');
  });

  it('refuses a Pro model', () => {
    expect(() => recommender('gemini-2.5-pro')).toThrow('Flash or Flash-Lite');
  });
});
