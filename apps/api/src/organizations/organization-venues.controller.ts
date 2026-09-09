import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { OrgScoped } from '../auth/decorators/org-scoped.decorator';
import { OrgPermissionGuard } from '../auth/guards/org-permission.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentOrgId } from '../common/decorators/current-org-id.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RequireOrgPermission } from '../common/decorators/org-permission.decorator';
import { CreateVenueDto } from '../venues/dto/create-venue.dto';
import { VenuesService } from '../venues/venues.service';

@Controller('organizations/:organizationId/venues')
export class OrganizationVenuesController {
  constructor(private readonly venuesService: VenuesService) {}

  @Post()
  @UseGuards(RolesGuard, OrgPermissionGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN)
  @RequireOrgPermission('zones')
  @OrgScoped('organizationId')
  create(
    @CurrentOrgId() organizationId: string,
    @Body() input: CreateVenueDto,
  ) {
    return this.venuesService.create(input, organizationId);
  }
}
