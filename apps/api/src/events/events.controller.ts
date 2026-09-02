import { Controller, Get, Param } from '@nestjs/common';
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

  @Get('by-slug/:slug/map')
  findMapBySlug(@Param('slug') slug: string) {
    return this.eventsService.findMapBySlug(slug);
  }

  @Get(':id/map')
  findMap(@Param('id') id: string) {
    return this.eventsService.findMap(id);
  }
}
