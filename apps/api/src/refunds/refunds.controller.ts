import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { UserRole, type User } from '@prisma/client';
import { OrgScoped } from '../auth/decorators/org-scoped.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { SupabaseAuthGuard } from '../auth/guards/supabase-auth.guard';
import { CurrentOrgId } from '../common/decorators/current-org-id.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { ApproveRefundRequestDto } from './dto/approve-refund-request.dto';
import { CreateRefundRequestDto } from './dto/create-refund-request.dto';
import { RefundsService } from './refunds.service';

@Controller()
@UseGuards(SupabaseAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN)
export class RefundsController {
  constructor(private readonly refundsService: RefundsService) {}

  @Post('bookings/:bookingId/refunds')
  @Roles(UserRole.VENDOR)
  create(
    @Param('bookingId') bookingId: string,
    @Body() createRefundRequestDto: CreateRefundRequestDto,
    @CurrentUser() currentUser: User,
  ) {
    return this.refundsService.create(
      bookingId,
      currentUser.id,
      createRefundRequestDto,
    );
  }

  @Get('refunds/mine')
  @Roles(UserRole.VENDOR)
  findMine(@CurrentUser() currentUser: User) {
    return this.refundsService.findMine(currentUser.id);
  }

  @Get('refunds/all')
  @Roles(UserRole.SUPER_ADMIN)
  findAllAcrossOrganizations() {
    return this.refundsService.findAllAcrossOrganizations();
  }

  @Get('organizations/:organizationId/refunds')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN)
  @OrgScoped('organizationId')
  findForOrganization(@CurrentOrgId() organizationId: string) {
    return this.refundsService.findForOrganization(organizationId);
  }

  @Patch('bookings/:bookingId/refunds/:refundId/approve')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN)
  @OrgScoped('bookingId')
  approve(
    @Param('bookingId') bookingId: string,
    @Param('refundId') refundId: string,
    @Body() approveRefundRequestDto: ApproveRefundRequestDto,
    @CurrentOrgId() organizationId: string,
    @CurrentUser() currentUser: User,
  ) {
    return this.refundsService.approve(
      bookingId,
      refundId,
      organizationId,
      currentUser.id,
      approveRefundRequestDto,
    );
  }

  @Patch('bookings/:bookingId/refunds/:refundId/reject')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN)
  @OrgScoped('bookingId')
  reject(
    @Param('bookingId') bookingId: string,
    @Param('refundId') refundId: string,
    @CurrentOrgId() organizationId: string,
    @CurrentUser() currentUser: User,
  ) {
    return this.refundsService.reject(
      bookingId,
      refundId,
      organizationId,
      currentUser.id,
    );
  }

  @Patch('bookings/:bookingId/refunds/:refundId/process')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN)
  @OrgScoped('bookingId')
  process(
    @Param('bookingId') bookingId: string,
    @Param('refundId') refundId: string,
    @CurrentOrgId() organizationId: string,
  ) {
    return this.refundsService.process(bookingId, refundId, organizationId);
  }
}
