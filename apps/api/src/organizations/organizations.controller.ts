import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { UserRole, type User } from '@prisma/client';
import { OrgScoped } from '../auth/decorators/org-scoped.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { SupabaseAuthGuard } from '../auth/guards/supabase-auth.guard';
import { OrgPermissionGuard } from '../auth/guards/org-permission.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RequireOrgPermission } from '../common/decorators/org-permission.decorator';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { GrantAdminDto } from './dto/grant-admin.dto';
import { UpdateBookingQuotaDto } from './dto/update-booking-quota.dto';
import { UpdateOrganizationStatusDto } from './dto/update-organization-status.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { SetOwnerDto } from './dto/set-owner.dto';
import { UpdateAdminPermissionsDto } from './dto/update-admin-permissions.dto';
import { OrganizationsService } from './organizations.service';

@Controller('organizations')
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Post()
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  create(
    @Body() createOrganizationDto: CreateOrganizationDto,
    @CurrentUser() currentUser: User,
  ) {
    return this.organizationsService.create(
      createOrganizationDto,
      currentUser.id,
    );
  }

  @Get()
  findAll() {
    return this.organizationsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.organizationsService.findOne(id);
  }

  @Get(':organizationId/admins')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN)
  @OrgScoped('organizationId')
  listAdmins(@Param('organizationId') organizationId: string) {
    return this.organizationsService.listAdmins(organizationId);
  }

  @Post(':organizationId/admins')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ORG_ADMIN)
  @OrgScoped('organizationId')
  grantAdmin(
    @Param('organizationId') organizationId: string,
    @Body() grantAdminDto: GrantAdminDto,
    @CurrentUser() currentUser: User,
  ) {
    return this.organizationsService.grantAdmin(
      organizationId,
      grantAdminDto.email,
      currentUser.id,
    );
  }

  @Delete(':organizationId/admins/:userId')
  @HttpCode(204)
  @UseGuards(RolesGuard)
  @Roles(UserRole.ORG_ADMIN)
  @OrgScoped('organizationId')
  revokeAdmin(
    @Param('organizationId') organizationId: string,
    @Param('userId') userId: string,
    @CurrentUser() currentUser: User,
  ) {
    return this.organizationsService.revokeAdmin(
      organizationId,
      userId,
      currentUser.id,
    );
  }

  @Patch(':organizationId/admins/:membershipId/permissions')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ORG_ADMIN)
  @OrgScoped('organizationId')
  updateAdminPermissions(
    @Param('organizationId') organizationId: string,
    @Param('membershipId') membershipId: string,
    @Body() input: UpdateAdminPermissionsDto,
    @CurrentUser() currentUser: User,
  ) {
    return this.organizationsService.updateAdminPermissions(
      organizationId,
      membershipId,
      input,
      currentUser.id,
    );
  }

  @Patch(':organizationId/owner')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @OrgScoped('organizationId')
  setOwner(
    @Param('organizationId') organizationId: string,
    @Body() input: SetOwnerDto,
    @CurrentUser() currentUser: User,
  ) {
    return this.organizationsService.setOwner(
      organizationId,
      input.email,
      currentUser.id,
    );
  }

  @Patch(':organizationId/quota')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN)
  @OrgScoped('organizationId')
  updateBookingQuota(
    @Param('organizationId') organizationId: string,
    @Body() updateBookingQuotaDto: UpdateBookingQuotaDto,
    @CurrentUser() currentUser: User,
  ) {
    return this.organizationsService.updateBookingQuota(
      organizationId,
      updateBookingQuotaDto.bookingQuotaPerVendor,
      currentUser,
      currentUser.id,
    );
  }

  @Patch(':organizationId')
  @UseGuards(RolesGuard, OrgPermissionGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN)
  @RequireOrgPermission('payments')
  @OrgScoped('organizationId')
  update(
    @Param('organizationId') organizationId: string,
    @Body() updateOrganizationDto: UpdateOrganizationDto,
  ) {
    return this.organizationsService.update(
      organizationId,
      updateOrganizationDto,
    );
  }

  @Patch(':organizationId/status')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @OrgScoped('organizationId')
  updateStatus(
    @Param('organizationId') organizationId: string,
    @Body() updateStatusDto: UpdateOrganizationStatusDto,
    @CurrentUser() currentUser: User,
  ) {
    return this.organizationsService.updateStatus(
      organizationId,
      updateStatusDto.status,
      currentUser.id,
    );
  }
}
