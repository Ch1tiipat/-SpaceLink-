import { Controller, Get, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { RolesGuard } from '../auth/guards/roles.guard';
import { SupabaseAuthGuard } from '../auth/guards/supabase-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { AnnouncementsService } from './announcements.service';

@Controller('announcements')
export class AnnouncementsAdminController {
  constructor(private readonly announcementsService: AnnouncementsService) {}

  @Get('all')
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  findAll() {
    return this.announcementsService.findAllAcrossOrganizations();
  }
}
