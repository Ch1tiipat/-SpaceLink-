import {
  Body,
  Controller,
  Delete,
  Headers,
  Post,
  UseGuards,
} from '@nestjs/common';
import type { User } from '@prisma/client';
import { SupabaseAuthGuard } from '../auth/guards/supabase-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CreatePushSubscriptionDto } from './dto/create-push-subscription.dto';
import { DeletePushSubscriptionDto } from './dto/delete-push-subscription.dto';
import { PushSubscriptionsService } from './push-subscriptions.service';

@Controller('push-subscriptions')
@UseGuards(SupabaseAuthGuard)
export class PushSubscriptionsController {
  constructor(
    private readonly pushSubscriptionsService: PushSubscriptionsService,
  ) {}

  @Post()
  create(
    @CurrentUser() currentUser: User,
    @Body() input: CreatePushSubscriptionDto,
    @Headers('user-agent') userAgent?: string,
  ) {
    return this.pushSubscriptionsService.upsert(
      currentUser.id,
      input,
      userAgent,
    );
  }

  @Delete()
  delete(
    @CurrentUser() currentUser: User,
    @Body() input: DeletePushSubscriptionDto,
  ) {
    return this.pushSubscriptionsService.delete(currentUser.id, input.endpoint);
  }
}
