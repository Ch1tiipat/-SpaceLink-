import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { OrgScoped } from '../auth/decorators/org-scoped.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentOrgId } from '../common/decorators/current-org-id.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { CreatePenaltyDto } from './dto/create-penalty.dto';
import { PenaltiesService } from './penalties.service';

@Controller('bookings/:bookingId/penalties')
export class PenaltiesController {
  constructor(private readonly penaltiesService: PenaltiesService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN)
  @OrgScoped('bookingId')
  create(
    @Param('bookingId') bookingId: string,
    @CurrentOrgId() organizationId: string,
    @Body() createPenaltyDto: CreatePenaltyDto,
  ) {
    return this.penaltiesService.create(
      bookingId,
      organizationId,
      createPenaltyDto,
    );
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN)
  @OrgScoped('bookingId')
  findAll(
    @Param('bookingId') bookingId: string,
    @CurrentOrgId() organizationId: string,
  ) {
    return this.penaltiesService.listForBookingVendor(
      bookingId,
      organizationId,
    );
  }
}
