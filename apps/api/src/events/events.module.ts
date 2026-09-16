import { Module } from '@nestjs/common';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { EventsService } from './events.service';
import { EventsController } from './events.controller';
import { OrganizationEventsController } from './organization-events.controller';
import { EventGalleryStorageService } from './event-gallery-storage.service';
import { EventJoinInformationService } from './event-join-information.service';
import { EventInformationService } from './event-information.service';
import { EventBannerStorageService } from './event-banner-storage.service';

@Module({
  imports: [AuditLogsModule],
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
