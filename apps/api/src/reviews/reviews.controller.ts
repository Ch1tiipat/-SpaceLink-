import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { UserRole, type User } from '@prisma/client';
import { RolesGuard } from '../auth/guards/roles.guard';
import { SupabaseAuthGuard } from '../auth/guards/supabase-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AverageRatingQueryDto } from './dto/average-rating-query.dto';
import { CreateReviewDto } from './dto/create-review.dto';
import { ReviewsService } from './reviews.service';

@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  // Public so a vendor can compare booth ratings before signing in.
  @Get('average')
  getAverage(@Query() query: AverageRatingQueryDto) {
    return this.reviewsService.getAverage(query.targetType, query.targetId);
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
}
