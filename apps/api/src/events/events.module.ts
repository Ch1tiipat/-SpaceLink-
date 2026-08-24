import { Module } from '@nestjs/common';
import { EventsService } from './events.service';
import { EventsController } from './events.controller';
import { OrganizationEventsController } from './organization-events.controller';

@Module({
  controllers: [EventsController, OrganizationEventsController],
  providers: [EventsService],
})
export class EventsModule {}
