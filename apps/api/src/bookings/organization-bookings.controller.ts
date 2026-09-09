import { Controller, Get, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { OrgScoped } from '../auth/decorators/org-scoped.decorator';
import { OrgPermissionGuard } from '../auth/guards/org-permission.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentOrgId } from '../common/decorators/current-org-id.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RequireOrgPermission } from '../common/decorators/org-permission.decorator';
import { BookingsService } from './bookings.service';

@Controller('organizations/:organizationId/bookings')
export class OrganizationBookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Get()
  @UseGuards(RolesGuard, OrgPermissionGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN)
  @RequireOrgPermission('payments')
  @OrgScoped('organizationId')
  findByOrganization(@CurrentOrgId() organizationId: string) {
    return this.bookingsService.findByOrganization(organizationId);
  }
}
