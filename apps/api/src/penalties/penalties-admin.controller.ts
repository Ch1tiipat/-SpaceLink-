import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { RolesGuard } from '../auth/guards/roles.guard';
import { SupabaseAuthGuard } from '../auth/guards/supabase-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CreateAdminPenaltyDto } from './dto/create-admin-penalty.dto';
import { PenaltiesService } from './penalties.service';

@Controller('penalties')
export class PenaltiesAdminController {
  constructor(private readonly penaltiesService: PenaltiesService) {}

  @Post()
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  create(@Body() createPenaltyDto: CreateAdminPenaltyDto) {
    return this.penaltiesService.createForUser(createPenaltyDto);
  }

  @Get('all')
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  findAll() {
    return this.penaltiesService.findAllAcrossOrganizations();
  }
}
