import {
  Controller,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import type { User } from '@prisma/client';
import { SupabaseAuthGuard } from '../auth/guards/supabase-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ListNotificationsQueryDto } from './dto/list-notifications-query.dto';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
@UseGuards(SupabaseAuthGuard, RolesGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  findMine(
    @CurrentUser() currentUser: User,
    @Query() query: ListNotificationsQueryDto,
  ) {
    return this.notificationsService.findMine(currentUser.id, query.unreadOnly);
  }

  @Get('unread-count')
  unreadCount(@CurrentUser() currentUser: User) {
    return this.notificationsService.unreadCount(currentUser.id);
  }

  @Patch('mark-all-read')
  markAllRead(@CurrentUser() currentUser: User) {
    return this.notificationsService.markAllRead(currentUser.id);
  }

  @Patch(':notificationId/read')
  markRead(
    @Param('notificationId') notificationId: string,
    @CurrentUser() currentUser: User,
  ) {
    return this.notificationsService.markRead(currentUser.id, notificationId);
  }
}
