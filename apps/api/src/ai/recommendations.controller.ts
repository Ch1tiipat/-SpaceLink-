import {
  BadRequestException,
  Body,
  Controller,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import type { User } from '@prisma/client';
import { SupabaseAuthGuard } from '../auth/guards/supabase-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRecommendationDto } from './dto/create-recommendation.dto';
import { ZoneRecommendationService } from './zone-recommendation.service';

@Controller('events')
@UseGuards(SupabaseAuthGuard)
export class RecommendationsController {
  constructor(
    private readonly zoneRecommendations: ZoneRecommendationService,
    private readonly prisma: PrismaService,
  ) {}

  @Post(':eventId/recommendations')
  async recommend(
    @Param('eventId', new ParseUUIDPipe()) eventId: string,
    @CurrentUser() vendor: User,
    @Body() input: CreateRecommendationDto,
  ) {
    const shop = await this.prisma.shop.findFirst({
      where: { id: input.shopId, ownerUserId: vendor.id },
      select: {
        categories: { select: { categoryId: true } },
      },
    });

    // Return the same answer for a missing shop and somebody else's shop so a
    // vendor cannot use this endpoint to discover another vendor's shop ids.
    if (!shop) {
      throw new NotFoundException('ไม่พบร้านค้าที่เลือก');
    }

    const shopCategoryIds = shop.categories.map(
      (category) => category.categoryId,
    );
    const requestedCategoryIds = input.productCategoryIds;

    if (
      requestedCategoryIds?.some(
        (categoryId) => !shopCategoryIds.includes(categoryId),
      )
    ) {
      throw new BadRequestException(
        'หมวดสินค้าที่เลือกต้องเป็นหมวดสินค้าของร้านนี้',
      );
    }

    return this.zoneRecommendations.recommend({
      eventId,
      vendorUserId: vendor.id,
      productCategoryIds: requestedCategoryIds ?? shopCategoryIds,
      preferredZoneId: input.preferredZoneId,
      requiredFacilities: normalizeFacilities(input.requiredFacilities),
      limit: input.limit,
    });
  }
}

function normalizeFacilities(facilities: string[] | undefined) {
  if (!facilities) return undefined;

  return [
    ...new Set(facilities.map((facility) => facility.trim()).filter(Boolean)),
  ];
}
