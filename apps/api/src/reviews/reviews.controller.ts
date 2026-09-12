import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { UserRole, type User } from '@prisma/client';
import { OrgScoped } from '../auth/decorators/org-scoped.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { SupabaseAuthGuard } from '../auth/guards/supabase-auth.guard';
import { CurrentOrgId } from '../common/decorators/current-org-id.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AdminReviewsQueryDto } from './dto/admin-reviews-query.dto';
import { AverageRatingQueryDto } from './dto/average-rating-query.dto';
import { CreateReviewDto } from './dto/create-review.dto';
import { ModerateReviewDto } from './dto/moderate-review.dto';
import { MyReviewsQueryDto } from './dto/my-reviews-query.dto';
import { ReviewsService } from './reviews.service';

@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  // Public so a vendor can compare booth ratings before signing in.
  @Get('average')
  getAverage(@Query() query: AverageRatingQueryDto) {
    return this.reviewsService.getAverage(query.targetType, query.targetId);
  }

  @Get('events/:eventId')
  getForEvent(
    @Param('eventId') eventId: string,
    @Query() query: MyReviewsQueryDto,
  ) {
    return this.reviewsService.getForEvent(eventId, query.page, query.limit);
  }

  @Get('me')
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR)
  getMine(@Query() query: MyReviewsQueryDto, @CurrentUser() currentUser: User) {
    return this.reviewsService.getMine(currentUser.id, query.page, query.limit);
  }

  @Get('organizations/:organizationId')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN)
  @OrgScoped('organizationId')
  listForOrganization(
    @CurrentOrgId() organizationId: string,
    @Query() query: AdminReviewsQueryDto,
  ) {
    return this.reviewsService.listForOrganization(organizationId, query);
  }

  @Post()
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR)
  create(
    @Body() createReviewDto: CreateReviewDto,
    @CurrentUser() currentUser: User,
  ) {
    return this.reviewsService.create(currentUser.id, createReviewDto);
  }

  @Patch(':reviewId/hide')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN)
  @OrgScoped('reviewId')
  hide(
    @Param('reviewId') reviewId: string,
    @Body() dto: ModerateReviewDto,
    @CurrentUser() currentUser: User,
  ) {
    return this.reviewsService.hide(reviewId, currentUser.id, dto.reason);
  }

  @Patch(':reviewId/restore')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN)
  @OrgScoped('reviewId')
  restore(
    @Param('reviewId') reviewId: string,
    @Body() dto: ModerateReviewDto,
    @CurrentUser() currentUser: User,
  ) {
    return this.reviewsService.restore(reviewId, currentUser.id, dto.reason);
  }

  @Delete(':reviewId')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN)
  @OrgScoped('reviewId')
  softDelete(
    @Param('reviewId') reviewId: string,
    @Body() dto: ModerateReviewDto,
    @CurrentUser() currentUser: User,
  ) {
    return this.reviewsService.softDelete(reviewId, currentUser.id, dto.reason);
  }
}
