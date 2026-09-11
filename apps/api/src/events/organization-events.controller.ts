import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UploadedFiles,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { UserRole } from '@prisma/client';
import { OrgScoped } from '../auth/decorators/org-scoped.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentOrgId } from '../common/decorators/current-org-id.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { LooseUuidPipe } from '../common/pipes/loose-uuid.pipe';
import { CreateEventDto } from './dto/create-event.dto';
import { CreateEventInformationDto } from './dto/create-event-information.dto';
import { CreateEventJoinInformationDto } from './dto/create-event-join-information.dto';
import { ReorderEventInformationDto } from './dto/reorder-event-information.dto';
import { ReorderEventJoinInformationDto } from './dto/reorder-event-join-information.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { UpdateEventInformationDto } from './dto/update-event-information.dto';
import { UpdateEventJoinInformationDto } from './dto/update-event-join-information.dto';
import { EventInformationService } from './event-information.service';
import { EventJoinInformationService } from './event-join-information.service';
import { EventsService } from './events.service';
import {
  MAX_EVENT_GALLERY_FILES,
  MAX_EVENT_GALLERY_FILE_SIZE_BYTES,
  type UploadedEventGalleryFile,
} from './event-gallery-storage.service';
import {
  MAX_EVENT_BANNER_FILE_SIZE_BYTES,
  type UploadedEventBannerFile,
} from './event-banner-storage.service';

@Controller('organizations/:organizationId/events')
export class OrganizationEventsController {
  constructor(
    private readonly eventsService: EventsService,
    private readonly joinInformationService: EventJoinInformationService,
    private readonly informationService: EventInformationService,
  ) {}

  @Post('quote')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN)
  @OrgScoped('organizationId')
  quoteSubscription(
    @CurrentOrgId() organizationId: string,
    @Body() input: CreateEventDto,
  ) {
    return this.eventsService.quoteSubscription(input, organizationId);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN)
  @OrgScoped('organizationId')
  create(
    @CurrentOrgId() organizationId: string,
    @Body() input: CreateEventDto,
  ) {
    return this.eventsService.create(input, organizationId);
  }

  @Post(':eventId/gallery')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN)
  @OrgScoped('organizationId')
  @UseInterceptors(
    FilesInterceptor('files', MAX_EVENT_GALLERY_FILES, {
      limits: {
        files: MAX_EVENT_GALLERY_FILES,
        fileSize: MAX_EVENT_GALLERY_FILE_SIZE_BYTES,
      },
    }),
  )
  uploadGallery(
    @CurrentOrgId() organizationId: string,
    @Param('eventId', new LooseUuidPipe()) eventId: string,
    @UploadedFiles() files: UploadedEventGalleryFile[] | undefined,
  ) {
    return this.eventsService.uploadGallery(
      eventId,
      organizationId,
      files ?? [],
    );
  }

  @Post(':eventId/banner')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN)
  @OrgScoped('organizationId')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { files: 1, fileSize: MAX_EVENT_BANNER_FILE_SIZE_BYTES },
    }),
  )
  uploadBanner(
    @CurrentOrgId() organizationId: string,
    @Param('eventId', new LooseUuidPipe()) eventId: string,
    @UploadedFile() file: UploadedEventBannerFile | undefined,
  ) {
    return this.eventsService.uploadBanner(eventId, organizationId, file);
  }

  @Delete(':eventId/banner')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN)
  @OrgScoped('organizationId')
  removeBanner(
    @CurrentOrgId() organizationId: string,
    @Param('eventId', new LooseUuidPipe()) eventId: string,
  ) {
    return this.eventsService.removeBanner(eventId, organizationId);
  }

  @Post(':eventId/join-information')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ORG_ADMIN)
  @OrgScoped('organizationId')
  createJoinInformation(
    @CurrentOrgId() organizationId: string,
    @Param('eventId', new LooseUuidPipe()) eventId: string,
    @Body() input: CreateEventJoinInformationDto,
  ) {
    return this.joinInformationService.create(eventId, organizationId, input);
  }

  @Patch(':eventId/join-information/reorder')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ORG_ADMIN)
  @OrgScoped('organizationId')
  reorderJoinInformation(
    @CurrentOrgId() organizationId: string,
    @Param('eventId', new LooseUuidPipe()) eventId: string,
    @Body() input: ReorderEventJoinInformationDto,
  ) {
    return this.joinInformationService.reorder(
      eventId,
      organizationId,
      input.ids,
    );
  }

  @Patch(':eventId/join-information/:informationId')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ORG_ADMIN)
  @OrgScoped('organizationId')
  updateJoinInformation(
    @CurrentOrgId() organizationId: string,
    @Param('eventId', new LooseUuidPipe()) eventId: string,
    @Param('informationId', new LooseUuidPipe()) informationId: string,
    @Body() input: UpdateEventJoinInformationDto,
  ) {
    return this.joinInformationService.update(
      eventId,
      informationId,
      organizationId,
      input,
    );
  }

  @Delete(':eventId/join-information/:informationId')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ORG_ADMIN)
  @OrgScoped('organizationId')
  removeJoinInformation(
    @CurrentOrgId() organizationId: string,
    @Param('eventId', new LooseUuidPipe()) eventId: string,
    @Param('informationId', new LooseUuidPipe()) informationId: string,
  ) {
    return this.joinInformationService.remove(
      eventId,
      informationId,
      organizationId,
    );
  }

  @Post(':eventId/information')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ORG_ADMIN)
  @OrgScoped('organizationId')
  createInformation(
    @CurrentOrgId() organizationId: string,
    @Param('eventId', new LooseUuidPipe()) eventId: string,
    @Body() input: CreateEventInformationDto,
  ) {
    return this.informationService.create(eventId, organizationId, input);
  }

  @Patch(':eventId/information/reorder')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ORG_ADMIN)
  @OrgScoped('organizationId')
  reorderInformation(
    @CurrentOrgId() organizationId: string,
    @Param('eventId', new LooseUuidPipe()) eventId: string,
    @Body() input: ReorderEventInformationDto,
  ) {
    return this.informationService.reorder(eventId, organizationId, input.ids);
  }

  @Patch(':eventId/information/:informationId')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ORG_ADMIN)
  @OrgScoped('organizationId')
  updateInformation(
    @CurrentOrgId() organizationId: string,
    @Param('eventId', new LooseUuidPipe()) eventId: string,
    @Param('informationId', new LooseUuidPipe()) informationId: string,
    @Body() input: UpdateEventInformationDto,
  ) {
    return this.informationService.update(
      eventId,
      informationId,
      organizationId,
      input,
    );
  }

  @Delete(':eventId/information/:informationId')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ORG_ADMIN)
  @OrgScoped('organizationId')
  removeInformation(
    @CurrentOrgId() organizationId: string,
    @Param('eventId', new LooseUuidPipe()) eventId: string,
    @Param('informationId', new LooseUuidPipe()) informationId: string,
  ) {
    return this.informationService.remove(
      eventId,
      informationId,
      organizationId,
    );
  }

  @Patch(':eventId/publish')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN)
  @OrgScoped('organizationId')
  publish(
    @CurrentOrgId() organizationId: string,
    @Param('eventId', new LooseUuidPipe()) eventId: string,
  ) {
    return this.eventsService.publish(eventId, organizationId);
  }

  @Patch(':eventId/open')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN)
  @OrgScoped('organizationId')
  open(
    @CurrentOrgId() organizationId: string,
    @Param('eventId', new LooseUuidPipe()) eventId: string,
  ) {
    return this.eventsService.open(eventId, organizationId);
  }

  @Patch(':eventId/close')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN)
  @OrgScoped('organizationId')
  close(
    @CurrentOrgId() organizationId: string,
    @Param('eventId', new LooseUuidPipe()) eventId: string,
  ) {
    return this.eventsService.close(eventId, organizationId);
  }

  @Patch(':eventId')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN)
  @OrgScoped('organizationId')
  update(
    @CurrentOrgId() organizationId: string,
    @Param('eventId', new LooseUuidPipe()) eventId: string,
    @Body() input: UpdateEventDto,
  ) {
    return this.eventsService.update(eventId, input, organizationId);
  }

  @Delete(':eventId')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN)
  @OrgScoped('organizationId')
  remove(
    @CurrentOrgId() organizationId: string,
    @Param('eventId', new LooseUuidPipe()) eventId: string,
  ) {
    return this.eventsService.remove(eventId, organizationId);
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN)
  @OrgScoped('organizationId')
  findByOrganization(@CurrentOrgId() organizationId: string) {
    return this.eventsService.findByOrganization(organizationId);
  }
}
