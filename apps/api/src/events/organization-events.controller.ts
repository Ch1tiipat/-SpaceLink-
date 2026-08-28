import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
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

  @Get()
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN)
  @OrgScoped('organizationId')
  findByOrganization(@CurrentOrgId() organizationId: string) {
    return this.eventsService.findByOrganization(organizationId);
  }
}
