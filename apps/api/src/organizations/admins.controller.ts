import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { UserRole, type User } from '@prisma/client';
import { RolesGuard } from '../auth/guards/roles.guard';
import { SupabaseAuthGuard } from '../auth/guards/supabase-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { UpdateQuotaPermissionDto } from './dto/update-quota-permission.dto';
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

  @Patch(':membershipId/quota-permission')
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  updateQuotaPermission(
    @Param('membershipId') membershipId: string,
    @Body() updateQuotaPermissionDto: UpdateQuotaPermissionDto,
    @CurrentUser() currentUser: User,
  ) {
    return this.organizationsService.setQuotaEditPermission(
      membershipId,
      updateQuotaPermissionDto.canEditQuota,
      currentUser.id,
    );
  }
}
