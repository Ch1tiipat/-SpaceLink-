import { Module } from '@nestjs/common';
import { EventsService } from './events.service';
import { EventsController } from './events.controller';
import { OrganizationEventsController } from './organization-events.controller';
import { EventGalleryStorageService } from './event-gallery-storage.service';
import { EventJoinInformationService } from './event-join-information.service';

@Module({
  controllers: [EventsController, OrganizationEventsController],
  providers: [
    EventsService,
    EventGalleryStorageService,
    EventJoinInformationService,
  ],
})
export class EventsModule {}
