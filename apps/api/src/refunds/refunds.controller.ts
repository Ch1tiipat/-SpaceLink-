import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UserRole, type User } from '@prisma/client';
import { OrgScoped } from '../auth/decorators/org-scoped.decorator';
import { OrgPermissionGuard } from '../auth/guards/org-permission.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { SupabaseAuthGuard } from '../auth/guards/supabase-auth.guard';
import { CurrentOrgId } from '../common/decorators/current-org-id.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RequireOrgPermission } from '../common/decorators/org-permission.decorator';
import {
  MAX_SLIP_FILE_SIZE_BYTES,
  type UploadedSlipFile,
} from '../bookings/booking-slip-storage.service';
import { ApproveRefundRequestDto } from './dto/approve-refund-request.dto';
import { CreateRefundRequestDto } from './dto/create-refund-request.dto';
import { RefundsService } from './refunds.service';

const REFUND_SLIP_UPLOAD_LIMITS = {
  files: 1,
  fields: 0,
  parts: 2,
  fileSize: MAX_SLIP_FILE_SIZE_BYTES,
} as const;

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

  @Get('refunds/:refundId/payout-slip-url')
  @Roles(UserRole.VENDOR)
  getPayoutSlipUrl(
    @Param('refundId') refundId: string,
    @CurrentUser() currentUser: User,
  ) {
    return this.refundsService.createVendorPayoutSlipAccess(
      refundId,
      currentUser.id,
    );
  }

  @Get('refunds/all')
  @Roles(UserRole.SUPER_ADMIN)
  findAllAcrossOrganizations() {
    return this.refundsService.findAllAcrossOrganizations();
  }

  @Get('organizations/:organizationId/refunds')
  @UseGuards(OrgPermissionGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN)
  @RequireOrgPermission('payments')
  @OrgScoped('organizationId')
  findForOrganization(@CurrentOrgId() organizationId: string) {
    return this.refundsService.findForOrganization(organizationId);
  }

  @Patch('bookings/:bookingId/refunds/:refundId/approve')
  @UseGuards(OrgPermissionGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN)
  @RequireOrgPermission('payments')
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
  @UseGuards(OrgPermissionGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN)
  @RequireOrgPermission('payments')
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

  @Post('bookings/:bookingId/refunds/:refundId/payout-slip')
  @UseGuards(OrgPermissionGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN)
  @RequireOrgPermission('payments')
  @OrgScoped('bookingId')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: REFUND_SLIP_UPLOAD_LIMITS,
    }),
  )
  uploadPayoutSlip(
    @Param('bookingId') bookingId: string,
    @Param('refundId') refundId: string,
    @UploadedFile() file: UploadedSlipFile | undefined,
    @CurrentOrgId() organizationId: string,
    @CurrentUser() currentUser: User,
  ) {
    if (!file) {
      throw new BadRequestException('กรุณาแนบไฟล์สลิปคืนเงิน');
    }
    return this.refundsService.uploadPayoutSlip(
      bookingId,
      refundId,
      organizationId,
      currentUser.id,
      file,
    );
  }

  @Patch('bookings/:bookingId/refunds/:refundId/process')
  @UseGuards(OrgPermissionGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN)
  @RequireOrgPermission('payments')
  @OrgScoped('bookingId')
  process(
    @Param('bookingId') bookingId: string,
    @Param('refundId') refundId: string,
    @CurrentOrgId() organizationId: string,
  ) {
    return this.refundsService.process(bookingId, refundId, organizationId);
  }
}
