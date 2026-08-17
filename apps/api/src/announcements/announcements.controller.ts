import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { OrgScoped } from '../auth/decorators/org-scoped.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentOrgId } from '../common/decorators/current-org-id.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AnnouncementsService } from './announcements.service';
import { CreateAnnouncementDto } from './dto/create-announcement.dto';
import { UpdateAnnouncementDto } from './dto/update-announcement.dto';

@Controller('organizations')
export class AnnouncementsController {
  constructor(private readonly announcementsService: AnnouncementsService) {}

  // Public/vendor read — deliberately the only unguarded announcement route.
  @Get(':organizationId/announcements')
  findPublic(@Param('organizationId') organizationId: string) {
    return this.announcementsService.findPublic(organizationId);
  }

  @Get(':organizationId/announcements/admin')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN)
  @OrgScoped('organizationId')
  findAllForAdmin(@CurrentOrgId() organizationId: string) {
    return this.announcementsService.findAllForAdmin(organizationId);
  }

  @Post(':organizationId/announcements')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN)
  @OrgScoped('organizationId')
  create(
    @Body() createAnnouncementDto: CreateAnnouncementDto,
    @CurrentOrgId() organizationId: string,
  ) {
    return this.announcementsService.create(
      organizationId,
      createAnnouncementDto,
    );
  }

  @Patch(':organizationId/announcements/:announcementId')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN)
  @OrgScoped('organizationId')
  update(
    @Param('announcementId') announcementId: string,
    @Body() updateAnnouncementDto: UpdateAnnouncementDto,
    @CurrentOrgId() organizationId: string,
  ) {
    return this.announcementsService.update(
      announcementId,
      updateAnnouncementDto,
      organizationId,
    );
  }

  @Delete(':organizationId/announcements/:announcementId')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN)
  @OrgScoped('organizationId')
  remove(
    @Param('announcementId') announcementId: string,
    @CurrentOrgId() organizationId: string,
  ) {
    return this.announcementsService.remove(announcementId, organizationId);
  }
}
