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
import { UserRole } from '@prisma/client';
import { OrgScoped } from '../auth/decorators/org-scoped.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { SupabaseAuthGuard } from '../auth/guards/supabase-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { GrantAdminDto } from './dto/grant-admin.dto';
import { UpdateOrganizationStatusDto } from './dto/update-organization-status.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { OrganizationsService } from './organizations.service';

@Controller('organizations')
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Post()
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  create(@Body() createOrganizationDto: CreateOrganizationDto) {
    return this.organizationsService.create(createOrganizationDto);
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
  @Roles(UserRole.SUPER_ADMIN)
  @OrgScoped('organizationId')
  listAdmins(@Param('organizationId') organizationId: string) {
    return this.organizationsService.listAdmins(organizationId);
  }

  @Post(':organizationId/admins')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @OrgScoped('organizationId')
  grantAdmin(
    @Param('organizationId') organizationId: string,
    @Body() grantAdminDto: GrantAdminDto,
  ) {
    return this.organizationsService.grantAdmin(
      organizationId,
      grantAdminDto.email,
    );
  }

  @Delete(':organizationId/admins/:userId')
  @HttpCode(204)
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @OrgScoped('organizationId')
  revokeAdmin(
    @Param('organizationId') organizationId: string,
    @Param('userId') userId: string,
  ) {
    return this.organizationsService.revokeAdmin(organizationId, userId);
  }

  @Patch(':organizationId')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN)
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
  ) {
    return this.organizationsService.updateStatus(
      organizationId,
      updateStatusDto.status,
    );
  }
}
