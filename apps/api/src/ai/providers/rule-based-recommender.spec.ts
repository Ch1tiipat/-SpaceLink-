import { NotFoundException } from '@nestjs/common';
import {
  BookingStatus,
  BoothStatus,
  Prisma,
  RecommendationSource,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { ZoneRecommendationInput } from '../zone-recommender.interface';
import { RuleBasedZoneRecommender } from './rule-based-recommender';

const EVENT_ID = '11111111-1111-4111-8111-111111111111';
const VENUE_ID = '22222222-2222-4222-8222-222222222222';
const VENDOR_ID = '33333333-3333-4333-8333-333333333333';

const FOOD = { id: 'category-food', name: 'อาหาร' };
const CRAFT = { id: 'category-craft', name: 'งานฝีมือ' };

type BoothRow = {
  id: string;
  code: string;
  boothPrice: Prisma.Decimal;
  status: BoothStatus;
  zone: {
    id: string;
    code: string;
    name: string | null;
    categories: { categoryId: string; category: { name: string } }[];
  };
  facilities: Prisma.JsonValue | null;
  bookings: { status: BookingStatus }[];
};

/**
 * The mocked `findMany` ignores the `where` clause it is handed, so every row
 * built here reaches the recommender — including booths that a real query would
 * already have filtered out. That is the point: it puts the exclusion rules in
 * the code under test rather than in Prisma.
 */
function makeBooth(params: {
  code: string;
  price: string;
  zoneCode?: string;
  zoneId?: string;
  categories?: { id: string; name: string }[];
  facilities?: Prisma.JsonValue | null;
  bookings?: BookingStatus[];
  status?: BoothStatus;
}): BoothRow {
  return {
    id: `booth-${params.code}`,
    code: params.code,
    boothPrice: new Prisma.Decimal(params.price),
    facilities: params.facilities ?? null,
    status: params.status ?? BoothStatus.AVAILABLE,
    zone: {
      id: params.zoneId ?? `zone-${params.zoneCode ?? 'Z1'}`,
      code: params.zoneCode ?? 'Z1',
      name: null,
      categories: (params.categories ?? []).map((category) => ({
        categoryId: category.id,
        category: { name: category.name },
      })),
    },
    bookings: (params.bookings ?? []).map((status) => ({ status })),
  };
}

function makeInput(
  overrides: Partial<ZoneRecommendationInput> = {},
): ZoneRecommendationInput {
  return {
    eventId: EVENT_ID,
    vendorUserId: VENDOR_ID,
    productCategoryIds: [FOOD.id],
    ...overrides,
  };
}

describe('RuleBasedZoneRecommender', () => {
  let prisma: {
    event: { findUnique: jest.Mock };
    booth: { findMany: jest.Mock };
  };
  let recommender: RuleBasedZoneRecommender;

  beforeEach(() => {
    prisma = {
      event: { findUnique: jest.fn().mockResolvedValue({ venueId: VENUE_ID }) },
      booth: { findMany: jest.fn().mockResolvedValue([]) },
    };
    recommender = new RuleBasedZoneRecommender(
      prisma as unknown as PrismaService,
    );
  });

  it('rejects an unknown event without querying booths', async () => {
    prisma.event.findUnique.mockResolvedValue(null);

    await expect(recommender.recommend(makeInput())).rejects.toBeInstanceOf(
      NotFoundException,
    );

    expect(prisma.booth.findMany).not.toHaveBeenCalled();
  });

  /*
   * Invariant §6.3.3 is enforced twice on purpose — in the Prisma `where` and
   * in the TypeScript filter below. This test pins the SQL half.
   *
   * Without it only the TypeScript half is covered, and the two can drift: the
   * `where` clause could lose its booking exclusion, every test here would stay
   * green because the mock ignores `where` anyway, and production would happily
   * recommend booths somebody had already paid for.
   */
  it('asks Postgres to exclude booths held by an active booking', async () => {
    await recommender.recommend(makeInput());

    const [args] = prisma.booth.findMany.mock.calls[0] as [
      Prisma.BoothFindManyArgs,
    ];

    expect(args.where?.bookings?.none).toEqual({
      eventId: EVENT_ID,
      status: {
        in: [BookingStatus.PENDING_PAYMENT, BookingStatus.CONFIRMED],
      },
    });
    // Only booths at the event's venue are bookable at all (§6.3.1).
    expect(args.where?.zone).toEqual({ venueId: VENUE_ID });
  });

  // Category match is weighted above price, so the matching booth wins even
  // though it is the more expensive of the two.
  it('ranks a booth whose zone matches a requested category above one that does not', async () => {
    prisma.booth.findMany.mockResolvedValue([
      makeBooth({ code: 'A01', price: '2000.00', categories: [FOOD] }),
      makeBooth({ code: 'B01', price: '1000.00', zoneCode: 'Z2' }),
    ]);

    const result = await recommender.recommend(makeInput());

    expect(result.map((booth) => booth.boothId)).toEqual([
      'booth-A01',
      'booth-B01',
    ]);
    expect(result[0].score).toBeGreaterThan(result[1].score);
    expect(result[0].source).toBe(RecommendationSource.RULE_BASED);
    expect(result[0].reason).toContain('ตรงกับหมวดสินค้าที่เลือกทั้งหมด');
    expect(result[0].reason).toContain(FOOD.name);
    expect(result[1].reason).toContain('ไม่ตรงกับหมวดสินค้าที่เลือก');
  });

  it('excludes a booth that already has a PENDING_PAYMENT booking', async () => {
    prisma.booth.findMany.mockResolvedValue([
      makeBooth({
        code: 'A01',
        price: '1000.00',
        categories: [FOOD],
        bookings: [BookingStatus.PENDING_PAYMENT],
      }),
      makeBooth({ code: 'B01', price: '1000.00', categories: [FOOD] }),
    ]);

    const result = await recommender.recommend(makeInput());

    expect(result.map((booth) => booth.boothId)).toEqual(['booth-B01']);
  });

  it('excludes a booth that already has a CONFIRMED booking', async () => {
    prisma.booth.findMany.mockResolvedValue([
      makeBooth({
        code: 'A01',
        price: '1000.00',
        categories: [FOOD],
        bookings: [BookingStatus.CONFIRMED],
      }),
      makeBooth({ code: 'B01', price: '1000.00', categories: [FOOD] }),
    ]);

    const result = await recommender.recommend(makeInput());

    expect(result.map((booth) => booth.boothId)).toEqual(['booth-B01']);
  });

  // This is the property the 4 Sep demo rests on: no API key, no randomness,
  // and the same answer every time.
  it('breaks ties on booth code and returns the same order for the same input', async () => {
    // Deliberately handed back out of order — a stable sort alone would leave
    // B02 in front.
    prisma.booth.findMany.mockResolvedValue([
      makeBooth({ code: 'B02', price: '1500.00', categories: [FOOD] }),
      makeBooth({ code: 'A01', price: '1500.00', categories: [FOOD] }),
    ]);

    const first = await recommender.recommend(makeInput());
    const second = await recommender.recommend(makeInput());

    expect(first[0].score).toBe(first[1].score);
    expect(first.map((booth) => booth.boothId)).toEqual([
      'booth-A01',
      'booth-B02',
    ]);
    expect(second).toEqual(first);
  });

  it('returns at most `limit` booths', async () => {
    prisma.booth.findMany.mockResolvedValue([
      makeBooth({ code: 'A01', price: '1000.00', categories: [FOOD] }),
      makeBooth({ code: 'A02', price: '1000.00', categories: [FOOD] }),
      makeBooth({ code: 'B01', price: '1000.00', zoneCode: 'Z2' }),
      makeBooth({ code: 'B02', price: '1000.00', zoneCode: 'Z2' }),
    ]);

    const result = await recommender.recommend(makeInput({ limit: 2 }));

    expect(result.map((booth) => booth.boothId)).toEqual([
      'booth-A01',
      'booth-A02',
    ]);
  });

  /*
   * `ZoneRecommender` promises each boothId at most once. A `where` that fanned
   * out over a to-many relation would break that, and the mocked findMany is
   * the only place that can be shown — the same reason `isFree` is checked in
   * TypeScript rather than left to the query.
   */
  it('returns a booth once even when the query hands it back twice', async () => {
    prisma.booth.findMany.mockResolvedValue([
      makeBooth({ code: 'A01', price: '1000.00', categories: [FOOD] }),
      makeBooth({ code: 'A01', price: '1000.00', categories: [FOOD] }),
      makeBooth({ code: 'B01', price: '2000.00', zoneCode: 'Z2' }),
    ]);

    const result = await recommender.recommend(makeInput());

    expect(result.map((booth) => booth.boothId)).toEqual([
      'booth-A01',
      'booth-B01',
    ]);
  });

  it('scores on price alone when the vendor gives no categories', async () => {
    prisma.booth.findMany.mockResolvedValue([
      makeBooth({ code: 'A01', price: '3000.00', categories: [FOOD, CRAFT] }),
      makeBooth({ code: 'B01', price: '1000.00', zoneCode: 'Z2' }),
    ]);

    const result = await recommender.recommend(
      makeInput({ productCategoryIds: [] }),
    );

    expect(result.map((booth) => booth.boothId)).toEqual([
      'booth-B01',
      'booth-A01',
    ]);
    expect(result[0].reason).toContain('ไม่ได้ระบุหมวดสินค้า');
    expect(result[0].reason).toContain('ต่ำกว่าค่ากลางของงาน');
  });

  it('scores a partial category match below a full one', async () => {
    prisma.booth.findMany.mockResolvedValue([
      makeBooth({ code: 'A01', price: '1000.00', categories: [FOOD] }),
      makeBooth({
        code: 'B01',
        price: '1000.00',
        zoneCode: 'Z2',
        categories: [FOOD, CRAFT],
      }),
    ]);

    const result = await recommender.recommend(
      makeInput({ productCategoryIds: [FOOD.id, CRAFT.id] }),
    );

    expect(result.map((booth) => booth.boothId)).toEqual([
      'booth-B01',
      'booth-A01',
    ]);
    expect(result[0].reason).toContain('ตรงกับหมวดสินค้าที่เลือกทั้งหมด');
    expect(result[1].reason).toContain('ตรงกับหมวดสินค้าที่เลือกบางส่วน');
  });

  it('uses the preferred zone and requested facilities as ranking signals', async () => {
    prisma.booth.findMany.mockResolvedValue([
      makeBooth({
        code: 'A01',
        price: '1000.00',
        zoneId: 'zone-a',
        categories: [FOOD],
      }),
      makeBooth({
        code: 'B01',
        price: '1000.00',
        zoneCode: 'B',
        zoneId: 'zone-b',
        categories: [FOOD],
        facilities: ['power', 'table'],
      }),
    ]);

    const result = await recommender.recommend(
      makeInput({
        preferredZoneId: 'zone-b',
        requiredFacilities: ['ปลั๊กไฟ', 'โต๊ะ'],
      }),
    );

    expect(result.map((booth) => booth.boothId)).toEqual([
      'booth-B01',
      'booth-A01',
    ]);
    expect(result[0].reason).toContain('ตรงกับโซนที่เลือก');
    expect(result[0].reason).toContain('มีอุปกรณ์ที่ต้องการครบ');
    expect(result[1].reason).toContain('ผู้จัดยังไม่ระบุข้อมูลอุปกรณ์');
  });
});
