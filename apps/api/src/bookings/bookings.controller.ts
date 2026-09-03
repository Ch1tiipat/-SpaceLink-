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
import { SupabaseAuthGuard } from '../auth/guards/supabase-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentOrgId } from '../common/decorators/current-org-id.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import {
  MAX_SLIP_FILE_SIZE_BYTES,
  type UploadedSlipFile,
} from './booking-slip-storage.service';
import { BookingsService } from './bookings.service';
import { CancelBookingDto } from './dto/cancel-booking.dto';
import { ConfirmExemptBookingDto } from './dto/confirm-exempt-booking.dto';
import { CreateBookingDto } from './dto/create-booking.dto';

export const PAYMENT_SLIP_UPLOAD_LIMITS = {
  files: 1,
  fields: 0,
  // Busboy emits `partsLimit` when the parsed part count reaches this value.
  // Two therefore permits the one expected file while rejecting a second part.
  parts: 2,
  fileSize: MAX_SLIP_FILE_SIZE_BYTES,
} as const;

@Controller('bookings')
@UseGuards(SupabaseAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN)
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Post()
  @Roles(UserRole.VENDOR)
  create(
    @Body() createBookingDto: CreateBookingDto,
    @CurrentUser() currentUser: User,
  ) {
    return this.bookingsService.create(createBookingDto, currentUser.id);
  }

  @Post(':id/slip')
  @Roles(UserRole.VENDOR)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: PAYMENT_SLIP_UPLOAD_LIMITS,
    }),
  )
  uploadSlip(
    @Param('id') id: string,
    @UploadedFile() file: UploadedSlipFile | undefined,
    @CurrentUser() currentUser: User,
  ) {
    if (!file) {
      throw new BadRequestException('กรุณาแนบไฟล์สลิป');
    }
    return this.bookingsService.uploadSlip(id, file, currentUser.id);
  }

  @Patch(':id/cancel')
  @Roles(UserRole.VENDOR)
  cancel(
    @Param('id') id: string,
    @Body() cancelBookingDto: CancelBookingDto,
    @CurrentUser() currentUser: User,
  ) {
    return this.bookingsService.cancel(id, cancelBookingDto, currentUser.id);
  }

  @Get()
  @Roles(UserRole.VENDOR)
  findAll(@CurrentUser() currentUser: User) {
    return this.bookingsService.findAll(currentUser.id);
  }

  @Get('all')
  @Roles(UserRole.SUPER_ADMIN)
  findAllAcrossOrganizations() {
    return this.bookingsService.findAllAcrossOrganizations();
  }

  /**
   * Admin lookup by the code a vendor is actually shown. Declared before the
   * `:bookingId` route so the two never compete for a match.
   *
   * This is the one org-scoped route here that cannot use `@OrgScoped`:
   * OrgScopeGuard rejects any route param that is not a UUID, and a booking code
   * is not one. The ownership check therefore lives in the service, which §14.2
   * requires for `bookingCode` lookups regardless of how they are guarded.
   */
  @Get('by-code/:bookingCode')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN)
  findByCode(
    @Param('bookingCode') bookingCode: string,
    @CurrentUser() currentUser: User,
  ) {
    return this.bookingsService.findByCode(bookingCode, currentUser);
  }

  @Get(':bookingId/slip')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN)
  @OrgScoped('bookingId')
  getAdminSlip(
    @Param('bookingId') bookingId: string,
    @CurrentOrgId() orgId: string,
  ) {
    return this.bookingsService.createAdminSlipAccess(bookingId, orgId);
  }

  // The admin routes below are org-scoped. Their effective guard chain is
  // [SupabaseAuthGuard, RolesGuard, SupabaseAuthGuard, OrgScopeGuard]: Nest runs
  // controller-level guards before route-level ones, and `@OrgScoped` bundles its
  // own SupabaseAuthGuard alongside OrgScopeGuard. That guard therefore runs
  // twice on these two routes, costing one extra token verification and one
  // idempotent `findOrCreate`. Accepted rather than fixed — the alternatives are
  // splitting `@OrgScoped` into `@OrgScope` + `@UseGuards`, which AGENTS.md
  // forbids outright, or dropping the class-level guards, which would touch every
  // other route in this controller.
  @Patch(':bookingId/confirm-exempt')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN)
  @OrgScoped('bookingId')
  confirmExempt(
    @Param('bookingId') bookingId: string,
    @Body() confirmExemptBookingDto: ConfirmExemptBookingDto,
    @CurrentOrgId() orgId: string,
  ) {
    return this.bookingsService.confirmExempt(
      bookingId,
      confirmExemptBookingDto,
      orgId,
    );
  }

  @Get(':bookingId')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN)
  @OrgScoped('bookingId')
  findOne(
    @Param('bookingId') bookingId: string,
    @CurrentOrgId() orgId: string,
  ) {
    return this.bookingsService.findOne(bookingId, orgId);
  }
}
