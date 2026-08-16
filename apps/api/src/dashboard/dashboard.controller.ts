import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { OrgScoped } from '../auth/decorators/org-scoped.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentOrgId } from '../common/decorators/current-org-id.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { DashboardService } from './dashboard.service';

@Controller('organizations')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get(':organizationId/dashboard-summary')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN)
  @OrgScoped('organizationId')
  getSummary(
    @Param('organizationId') _organizationId: string,
    @CurrentOrgId() organizationId: string,
  ) {
    return this.dashboardService.getSummary(organizationId);
  }
}
