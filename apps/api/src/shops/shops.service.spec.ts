import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { CreateShopDto } from './dto/create-shop.dto';
import { UpdateShopDto } from './dto/update-shop.dto';
import { ShopsService } from './shops.service';

const OWNER_ID = '11111111-1111-4111-8111-111111111111';
const SHOP_ID = '22222222-2222-4222-8222-222222222222';
const CATEGORY_ID = '33333333-3333-4333-8333-333333333333';
const OTHER_CATEGORY_ID = '44444444-4444-4444-8444-444444444444';
const MISSING_CATEGORY_ID = '55555555-5555-4555-8555-555555555555';

const CREATE_DTO: CreateShopDto = {
  name: 'ร้านขนมไทย',
  description: 'ขนมไทยโบราณ',
  categoryIds: [CATEGORY_ID],
};

const SHOP_RECORD = {
  id: SHOP_ID,
  name: 'ร้านขนมไทย',
  description: 'ขนมไทยโบราณ',
  logoUrl: null,
  categories: [{ category: { id: CATEGORY_ID, name: 'อาหารและเครื่องดื่ม' } }],
};

const SHOP_RESPONSE = {
  id: SHOP_ID,
  name: 'ร้านขนมไทย',
  description: 'ขนมไทยโบราณ',
  logoUrl: null,
  categories: [{ id: CATEGORY_ID, name: 'อาหารและเครื่องดื่ม' }],
};

const shopFindFirst = jest.fn();
const shopCreate = jest.fn();
const shopUpdate = jest.fn();
const shopCategoryDeleteMany = jest.fn();
const shopCategoryCreateMany = jest.fn();
const productCategoryCount = jest.fn();
const prismaTransaction = jest.fn();

const mockPrismaService = {
  shop: {
    findFirst: shopFindFirst,
    create: shopCreate,
    update: shopUpdate,
  },
  shopCategory: {
    deleteMany: shopCategoryDeleteMany,
    createMany: shopCategoryCreateMany,
  },
  productCategory: { count: productCategoryCount },
  $transaction: prismaTransaction,
};

describe('ShopsService', () => {
  let service: ShopsService;

  beforeEach(async () => {
    jest.clearAllMocks();

    prismaTransaction.mockImplementation(
      (operation: (client: Prisma.TransactionClient) => Promise<unknown>) =>
        operation(mockPrismaService as unknown as Prisma.TransactionClient),
    );

    shopFindFirst.mockResolvedValue(null);
    shopCreate.mockResolvedValue(SHOP_RECORD);
    shopUpdate.mockResolvedValue(SHOP_RECORD);
    shopCategoryDeleteMany.mockResolvedValue({ count: 1 });
    shopCategoryCreateMany.mockResolvedValue({ count: 1 });
    productCategoryCount.mockResolvedValue(1);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ShopsService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<ShopsService>(ShopsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('creates the shop with its category rows and returns the me() shape', async () => {
      await expect(service.create(CREATE_DTO, OWNER_ID)).resolves.toEqual(
        SHOP_RESPONSE,
      );

      expect(shopCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            name: 'ร้านขนมไทย',
            description: 'ขนมไทยโบราณ',
            ownerUserId: OWNER_ID,
            categories: { create: [{ categoryId: CATEGORY_ID }] },
          },
        }),
      );
    });

    it('takes ownerUserId from the argument, never from the body', async () => {
      await service.create(CREATE_DTO, OWNER_ID);

      const [args] = shopCreate.mock.calls[0] as [
        { data: Prisma.ShopUncheckedCreateInput },
      ];
      expect(args.data.ownerUserId).toBe(OWNER_ID);
    });

    it('rejects a second shop for the same owner with 409', async () => {
      shopFindFirst.mockResolvedValue({ id: SHOP_ID });

      await expect(service.create(CREATE_DTO, OWNER_ID)).rejects.toThrow(
        new ConflictException('บัญชีนี้มีร้านค้าอยู่แล้ว'),
      );
      expect(shopCreate).not.toHaveBeenCalled();
    });

    it('checks for a duplicate inside the transaction, not before it', async () => {
      shopFindFirst.mockResolvedValue({ id: SHOP_ID });

      await expect(service.create(CREATE_DTO, OWNER_ID)).rejects.toThrow(
        ConflictException,
      );
      expect(prismaTransaction).toHaveBeenCalledTimes(1);
    });

    it('rejects an unknown categoryId with a Thai 400', async () => {
      productCategoryCount.mockResolvedValue(0);

      await expect(
        service.create(
          { ...CREATE_DTO, categoryIds: [MISSING_CATEGORY_ID] },
          OWNER_ID,
        ),
      ).rejects.toThrow(new BadRequestException('ไม่พบหมวดหมู่สินค้าที่เลือก'));
      expect(shopCreate).not.toHaveBeenCalled();
    });

    it('rejects when only some of the categoryIds exist', async () => {
      productCategoryCount.mockResolvedValue(1);

      await expect(
        service.create(
          { ...CREATE_DTO, categoryIds: [CATEGORY_ID, MISSING_CATEGORY_ID] },
          OWNER_ID,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('deduplicates categoryIds so a repeated id is not a composite-key clash', async () => {
      await service.create(
        { ...CREATE_DTO, categoryIds: [CATEGORY_ID, CATEGORY_ID] },
        OWNER_ID,
      );

      expect(productCategoryCount).toHaveBeenCalledWith({
        where: { id: { in: [CATEGORY_ID] } },
      });
      const [args] = shopCreate.mock.calls[0] as [
        { data: Prisma.ShopUncheckedCreateInput },
      ];
      expect(args.data.categories).toEqual({
        create: [{ categoryId: CATEGORY_ID }],
      });
    });
  });

  describe('updateMe', () => {
    it('returns 404 when the user has no shop', async () => {
      shopFindFirst.mockResolvedValue(null);

      await expect(
        service.updateMe({ name: 'ชื่อใหม่' }, OWNER_ID),
      ).rejects.toThrow(new NotFoundException('ไม่พบร้านค้าของผู้ใช้'));
      expect(shopUpdate).not.toHaveBeenCalled();
    });

    it('resolves the shop by ownerUserId, never by a client-supplied id', async () => {
      shopFindFirst.mockResolvedValue({ id: SHOP_ID });

      await service.updateMe({ name: 'ชื่อใหม่' }, OWNER_ID);

      expect(shopFindFirst).toHaveBeenCalledWith({
        where: { ownerUserId: OWNER_ID },
        select: { id: true },
      });
      expect(shopUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: SHOP_ID },
          data: { name: 'ชื่อใหม่' },
        }),
      );
    });

    it('leaves categories untouched when categoryIds is omitted', async () => {
      shopFindFirst.mockResolvedValue({ id: SHOP_ID });

      await service.updateMe({ description: 'คำอธิบายใหม่' }, OWNER_ID);

      expect(shopCategoryDeleteMany).not.toHaveBeenCalled();
      expect(shopCategoryCreateMany).not.toHaveBeenCalled();
      expect(productCategoryCount).not.toHaveBeenCalled();
    });

    it('replaces the category rows wholesale when categoryIds is sent', async () => {
      shopFindFirst.mockResolvedValue({ id: SHOP_ID });
      productCategoryCount.mockResolvedValue(2);
      const dto: UpdateShopDto = {
        categoryIds: [CATEGORY_ID, OTHER_CATEGORY_ID],
      };

      await service.updateMe(dto, OWNER_ID);

      expect(shopCategoryDeleteMany).toHaveBeenCalledWith({
        where: { shopId: SHOP_ID },
      });
      expect(shopCategoryCreateMany).toHaveBeenCalledWith({
        data: [
          { shopId: SHOP_ID, categoryId: CATEGORY_ID },
          { shopId: SHOP_ID, categoryId: OTHER_CATEGORY_ID },
        ],
      });
    });

    it('rejects an unknown categoryId with a Thai 400 before deleting anything', async () => {
      shopFindFirst.mockResolvedValue({ id: SHOP_ID });
      productCategoryCount.mockResolvedValue(0);

      await expect(
        service.updateMe({ categoryIds: [MISSING_CATEGORY_ID] }, OWNER_ID),
      ).rejects.toThrow(new BadRequestException('ไม่พบหมวดหมู่สินค้าที่เลือก'));
      expect(shopCategoryDeleteMany).not.toHaveBeenCalled();
      expect(shopUpdate).not.toHaveBeenCalled();
    });

    it('returns the me() shape', async () => {
      shopFindFirst.mockResolvedValue({ id: SHOP_ID });

      await expect(
        service.updateMe({ name: 'ร้านขนมไทย' }, OWNER_ID),
      ).resolves.toEqual(SHOP_RESPONSE);
    });
  });
});
