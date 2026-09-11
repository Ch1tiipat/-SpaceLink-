import { Module } from '@nestjs/common';
import { EventsService } from './events.service';
import { EventsController } from './events.controller';
import { OrganizationEventsController } from './organization-events.controller';
import { EventGalleryStorageService } from './event-gallery-storage.service';
import { EventJoinInformationService } from './event-join-information.service';
import { EventInformationService } from './event-information.service';
import { EventBannerStorageService } from './event-banner-storage.service';

@Module({
  controllers: [EventsController, OrganizationEventsController],
  providers: [
    EventsService,
    EventBannerStorageService,
    EventGalleryStorageService,
    EventJoinInformationService,
    EventInformationService,
  ],
})
export class EventsModule {}
