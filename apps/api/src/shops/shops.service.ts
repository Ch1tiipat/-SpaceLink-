import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateShopDto } from './dto/create-shop.dto';
import { UpdateShopDto } from './dto/update-shop.dto';

/**
 * The same projection AuthController.me() builds for its `shops[]` entries, so
 * a shop looks identical whether the page loaded it from /auth/me or got it
 * back from a write here.
 */
const shopSelect = {
  id: true,
  name: true,
  description: true,
  logoUrl: true,
  categories: {
    select: {
      category: { select: { id: true, name: true } },
    },
  },
} satisfies Prisma.ShopSelect;

type ShopRecord = Prisma.ShopGetPayload<{ select: typeof shopSelect }>;

export interface ShopResponse {
  id: string;
  name: string;
  description: string | null;
  logoUrl: string | null;
  categories: { id: string; name: string }[];
}

@Injectable()
export class ShopsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * One shop per vendor. That rule lives here and only here — `Shop` has no
   * unique index on `owner_user_id`, and the schema is frozen (§2.1), so the
   * duplicate check below is the whole enforcement. It runs inside the
   * transaction to keep the window small, but two simultaneous requests can
   * still both pass it. Same posture as invariant §6.3.3, which is likewise
   * service-code-only until someone adds the raw SQL index.
   */
  async create(
    createShopDto: CreateShopDto,
    ownerUserId: string,
  ): Promise<ShopResponse> {
    const { categoryIds, ...shopFields } = createShopDto;
    const uniqueCategoryIds = [...new Set(categoryIds)];

    const shop = await this.prisma.$transaction(async (transaction) => {
      const existing = await transaction.shop.findFirst({
        where: { ownerUserId },
        select: { id: true },
      });
      if (existing) {
        throw new ConflictException('บัญชีนี้มีร้านค้าอยู่แล้ว');
      }

      await this.assertCategoriesExist(transaction, uniqueCategoryIds);

      return transaction.shop.create({
        data: {
          ...shopFields,
          ownerUserId,
          categories: {
            create: uniqueCategoryIds.map((categoryId) => ({ categoryId })),
          },
        },
        select: shopSelect,
      });
    });

    return this.toResponse(shop);
  }

  /**
   * `/shops/me` takes no id: the shop is resolved from the authenticated user,
   * so a vendor cannot address anyone else's row (§14.2). A vendor with no
   * shop yet gets 404 and is expected to POST /shops instead.
   */
  async updateMe(
    updateShopDto: UpdateShopDto,
    ownerUserId: string,
  ): Promise<ShopResponse> {
    const { categoryIds, ...shopFields } = updateShopDto;
    const uniqueCategoryIds = categoryIds ? [...new Set(categoryIds)] : null;

    const shop = await this.prisma.$transaction(async (transaction) => {
      const existing = await transaction.shop.findFirst({
        where: { ownerUserId },
        select: { id: true },
      });
      if (!existing) {
        throw new NotFoundException('ไม่พบร้านค้าของผู้ใช้');
      }

      // Categories are replaced wholesale, not merged: the profile page sends
      // the full selection every time, so an absent `categoryIds` means "leave
      // them alone" and a present one means "these are now the categories".
      if (uniqueCategoryIds) {
        await this.assertCategoriesExist(transaction, uniqueCategoryIds);
        await transaction.shopCategory.deleteMany({
          where: { shopId: existing.id },
        });
        await transaction.shopCategory.createMany({
          data: uniqueCategoryIds.map((categoryId) => ({
            shopId: existing.id,
            categoryId,
          })),
        });
      }

      return transaction.shop.update({
        where: { id: existing.id },
        data: shopFields,
        select: shopSelect,
      });
    });

    return this.toResponse(shop);
  }

  /**
   * Checked explicitly rather than left to the foreign key. PrismaExceptionFilter
   * does turn a P2003 into a 400, but with the English "Related resource does
   * not exist" — every other vendor-facing message in this codebase is Thai.
   *
   * The count comparison is only exact because the caller deduplicates first.
   */
  private async assertCategoriesExist(
    transaction: Prisma.TransactionClient,
    categoryIds: string[],
  ): Promise<void> {
    const found = await transaction.productCategory.count({
      where: { id: { in: categoryIds } },
    });

    if (found !== categoryIds.length) {
      throw new BadRequestException('ไม่พบหมวดหมู่สินค้าที่เลือก');
    }
  }

  private toResponse(shop: ShopRecord): ShopResponse {
    return {
      id: shop.id,
      name: shop.name,
      description: shop.description,
      logoUrl: shop.logoUrl,
      categories: shop.categories.map(({ category }) => category),
    };
  }
}
