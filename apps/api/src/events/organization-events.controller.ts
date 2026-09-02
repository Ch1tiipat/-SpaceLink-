import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { OrgScoped } from '../auth/decorators/org-scoped.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentOrgId } from '../common/decorators/current-org-id.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { CreateEventDto } from './dto/create-event.dto';
import { EventsService } from './events.service';

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

  @Patch(':eventId/publish')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN)
  @OrgScoped('organizationId')
  publish(
    @CurrentOrgId() organizationId: string,
    @Param('eventId', new ParseUUIDPipe()) eventId: string,
  ) {
    return this.eventsService.publish(eventId, organizationId);
  }

  @Patch(':eventId/open')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN)
  @OrgScoped('organizationId')
  open(
    @CurrentOrgId() organizationId: string,
    @Param('eventId', new ParseUUIDPipe()) eventId: string,
  ) {
    return this.eventsService.open(eventId, organizationId);
  }

  @Patch(':eventId/close')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN)
  @OrgScoped('organizationId')
  close(
    @CurrentOrgId() organizationId: string,
    @Param('eventId', new ParseUUIDPipe()) eventId: string,
  ) {
    return this.eventsService.close(eventId, organizationId);
  }

  @Delete(':eventId')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN)
  @OrgScoped('organizationId')
  remove(
    @CurrentOrgId() organizationId: string,
    @Param('eventId', new ParseUUIDPipe()) eventId: string,
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
