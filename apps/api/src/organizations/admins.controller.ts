import { Controller, Get, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { RolesGuard } from '../auth/guards/roles.guard';
import { SupabaseAuthGuard } from '../auth/guards/supabase-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { OrganizationsService } from './organizations.service';

@Controller('admins')
export class AdminsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Get()
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  findAll() {
    return this.organizationsService.listAllAdmins();
  }
}
