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
import { SupabaseAuthGuard } from '../auth/guards/supabase-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import {
  MAX_SLIP_FILE_SIZE_BYTES,
  type UploadedSlipFile,
} from './booking-slip-storage.service';
import { BookingsService } from './bookings.service';
import { CancelBookingDto } from './dto/cancel-booking.dto';
import { CreateBookingDto } from './dto/create-booking.dto';

export const PAYMENT_SLIP_UPLOAD_LIMITS = {
  files: 1,
  fields: 0,
  parts: 1,
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

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.bookingsService.findOne(id);
  }
}
