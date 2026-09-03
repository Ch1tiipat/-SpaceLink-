import { BadRequestException, NotFoundException } from '@nestjs/common';
import { GUARDS_METADATA, ROUTE_ARGS_METADATA } from '@nestjs/common/constants';
import { Test } from '@nestjs/testing';
import type { User } from '@prisma/client';
import { UserRole } from '@prisma/client';
import { SupabaseAuthGuard } from '../auth/guards/supabase-auth.guard';
import { LooseUuidPipe } from '../common/pipes/loose-uuid.pipe';
import { PrismaService } from '../prisma/prisma.service';
import { RecommendationsController } from './recommendations.controller';
import { ZoneRecommendationService } from './zone-recommendation.service';

jest.mock('../auth/guards/supabase-auth.guard', () => ({
  SupabaseAuthGuard: class SupabaseAuthGuard {},
}));

const VENDOR_ID = '00000000-0000-4000-8000-000000000001';
const SHOP_ID = '00000000-0000-4000-8000-000000000002';
const EVENT_ID = '00000000-0000-4000-8000-000000000003';
const LEGACY_EVENT_ID = '44444444-4444-4444-4444-444444444444';
const CATEGORY_A = '00000000-0000-4000-8000-000000000004';
const CATEGORY_B = '00000000-0000-4000-8000-000000000005';
const OTHER_CATEGORY = '00000000-0000-4000-8000-000000000006';
const ZONE_ID = '00000000-0000-4000-8000-000000000008';

const vendor = {
  id: VENDOR_ID,
  authUserId: '00000000-0000-4000-8000-000000000007',
  email: 'vendor@example.com',
  fullName: 'Vendor Demo',
  phone: null,
  role: UserRole.VENDOR,
  isBlacklisted: false,
  blacklistReason: null,
  createdAt: new Date('2026-08-01T00:00:00.000Z'),
  updatedAt: new Date('2026-08-01T00:00:00.000Z'),
} satisfies User;

describe('RecommendationsController', () => {
  const findFirst = jest.fn();
  const recommend = jest.fn();
  let controller: RecommendationsController;

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleRef = await Test.createTestingModule({
      controllers: [RecommendationsController],
      providers: [
        {
          provide: ZoneRecommendationService,
          useValue: { recommend },
        },
        {
          provide: PrismaService,
          useValue: { shop: { findFirst } },
        },
      ],
    }).compile();

    controller = moduleRef.get(RecommendationsController);
  });

  it('requires Supabase authentication', () => {
    expect(
      Reflect.getMetadata(GUARDS_METADATA, RecommendationsController),
    ).toEqual([SupabaseAuthGuard]);
  });

  it('validates the event id by UUID shape', () => {
    const metadata = Reflect.getMetadata(
      ROUTE_ARGS_METADATA,
      RecommendationsController,
      'recommend',
    ) as Record<string, { data?: string; pipes?: unknown[] }>;
    const eventIdParameter = Object.values(metadata).find(
      (parameter) => parameter.data === 'eventId',
    );
    const pipe = eventIdParameter?.pipes?.find(
      (candidate) => candidate instanceof LooseUuidPipe,
    ) as LooseUuidPipe;

    expect(pipe).toBeInstanceOf(LooseUuidPipe);
    expect(pipe.transform(LEGACY_EVENT_ID)).toBe(LEGACY_EVENT_ID);
    expect(() => pipe.transform("' OR 1=1")).toThrow(BadRequestException);
  });

  it('uses every category from the selected vendor-owned shop by default', async () => {
    findFirst.mockResolvedValue({
      categories: [{ categoryId: CATEGORY_A }, { categoryId: CATEGORY_B }],
    });
    recommend.mockResolvedValue([]);

    await expect(
      controller.recommend(EVENT_ID, vendor, { shopId: SHOP_ID }),
    ).resolves.toEqual([]);

    expect(findFirst).toHaveBeenCalledWith({
      where: { id: SHOP_ID, ownerUserId: VENDOR_ID },
      select: { categories: { select: { categoryId: true } } },
    });
    expect(recommend).toHaveBeenCalledWith({
      eventId: EVENT_ID,
      vendorUserId: VENDOR_ID,
      productCategoryIds: [CATEGORY_A, CATEGORY_B],
      preferredZoneId: undefined,
      requiredFacilities: undefined,
      limit: undefined,
    });
  });

  it('allows a subset of the selected shop categories and passes the limit', async () => {
    findFirst.mockResolvedValue({
      categories: [{ categoryId: CATEGORY_A }, { categoryId: CATEGORY_B }],
    });
    recommend.mockResolvedValue([]);

    await controller.recommend(EVENT_ID, vendor, {
      shopId: SHOP_ID,
      productCategoryIds: [CATEGORY_B],
      limit: 3,
      preferredZoneId: ZONE_ID,
      requiredFacilities: [' ปลั๊กไฟ ', 'โต๊ะ', 'ปลั๊กไฟ'],
    });

    expect(recommend).toHaveBeenCalledWith({
      eventId: EVENT_ID,
      vendorUserId: VENDOR_ID,
      productCategoryIds: [CATEGORY_B],
      preferredZoneId: ZONE_ID,
      requiredFacilities: ['ปลั๊กไฟ', 'โต๊ะ'],
      limit: 3,
    });
  });

  it('rejects categories that are not attached to the selected shop', async () => {
    findFirst.mockResolvedValue({
      categories: [{ categoryId: CATEGORY_A }],
    });

    await expect(
      controller.recommend(EVENT_ID, vendor, {
        shopId: SHOP_ID,
        productCategoryIds: [OTHER_CATEGORY],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(recommend).not.toHaveBeenCalled();
  });

  it('does not reveal whether a shop belongs to another vendor', async () => {
    findFirst.mockResolvedValue(null);

    await expect(
      controller.recommend(EVENT_ID, vendor, { shopId: SHOP_ID }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(recommend).not.toHaveBeenCalled();
  });
});
