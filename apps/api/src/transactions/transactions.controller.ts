import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { OrgScoped } from '../auth/decorators/org-scoped.decorator';
import { OrgPermissionGuard } from '../auth/guards/org-permission.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentOrgId } from '../common/decorators/current-org-id.decorator';
import { RequireOrgPermission } from '../common/decorators/org-permission.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { LooseUuidPipe } from '../common/pipes/loose-uuid.pipe';
import { ListTransactionsQueryDto } from './dto/list-transactions-query.dto';
import { TransactionsService } from './transactions.service';

@Controller('organizations/:organizationId/transactions')
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Get()
  @UseGuards(RolesGuard, OrgPermissionGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN)
  @RequireOrgPermission('payments')
  @OrgScoped('organizationId')
  findAll(
    @CurrentOrgId() organizationId: string,
    @Query() query: ListTransactionsQueryDto,
  ) {
    return this.transactionsService.findAll(organizationId, query);
  }

  @Get('bookings/:bookingId')
  @UseGuards(RolesGuard, OrgPermissionGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN)
  @RequireOrgPermission('payments')
  @OrgScoped('organizationId')
  findBookingDetail(
    @CurrentOrgId() organizationId: string,
    @Param('bookingId', new LooseUuidPipe()) bookingId: string,
  ) {
    return this.transactionsService.findBookingDetail(
      organizationId,
      bookingId,
    );
  }
}
