import {
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import type { User } from '@prisma/client';
import { SupabaseAuthGuard } from '../auth/guards/supabase-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { EventsService } from './events.service';

@Controller('events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Get()
  findAll() {
    return this.eventsService.findDiscovery();
  }

  @Get('discovery')
  findDiscovery() {
    return this.eventsService.findDiscovery();
  }

  @Get('saved')
  @UseGuards(SupabaseAuthGuard)
  getSaved(@CurrentUser() currentUser: User) {
    return this.eventsService.getSavedEventIds(currentUser.id);
  }

  @Post(':id/save')
  @UseGuards(SupabaseAuthGuard)
  @HttpCode(204)
  save(@Param('id') id: string, @CurrentUser() currentUser: User) {
    return this.eventsService.saveEvent(id, currentUser.id);
  }

  @Delete(':id/save')
  @UseGuards(SupabaseAuthGuard)
  @HttpCode(204)
  unsave(@Param('id') id: string, @CurrentUser() currentUser: User) {
    return this.eventsService.unsaveEvent(id, currentUser.id);
  }

  @Get('by-slug/:slug/map')
  findMapBySlug(@Param('slug') slug: string) {
    return this.eventsService.findMapBySlug(slug);
  }

  @Get(':id/map')
  findMap(@Param('id') id: string) {
    return this.eventsService.findMap(id);
  }
}
