import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { UserRole } from '@prisma/client';
import { OrgScoped } from '../auth/decorators/org-scoped.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentOrgId } from '../common/decorators/current-org-id.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { LooseUuidPipe } from '../common/pipes/loose-uuid.pipe';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { EventsService } from './events.service';
import {
  MAX_EVENT_GALLERY_FILES,
  MAX_EVENT_GALLERY_FILE_SIZE_BYTES,
  type UploadedEventGalleryFile,
} from './event-gallery-storage.service';

@Controller('organizations/:organizationId/events')
export class OrganizationEventsController {
  constructor(private readonly eventsService: EventsService) {}

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
