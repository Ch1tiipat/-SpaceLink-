import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { OrgScoped } from '../auth/decorators/org-scoped.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { BoothsService } from '../booths/booths.service';
import { CreateBoothDto } from '../booths/dto/create-booth.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { FindAllZonesDto } from './dto/find-all-zones.dto';
import { UpdateZoneDto } from './dto/update-zone.dto';
import { ZonesService } from './zones.service';

@Controller('zones')
export class ZonesController {
  constructor(
    private readonly zonesService: ZonesService,
    private readonly boothsService: BoothsService,
  ) {}

  // Public discovery reads — deliberately unguarded, see zones.controller.spec.ts.
  @Get()
  findAll(@Query() query: FindAllZonesDto) {
    return this.zonesService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.zonesService.findOne(id);
  }

  // Mutation routes below. `@Roles` includes SUPER_ADMIN because OrgScopeGuard
  // already bypasses the membership check for that role — leaving it out here
  // would let a super admin pass OrgScopeGuard and then get wrongly rejected
  // by RolesGuard. Guard order note: this ordering resolves to
  // [SupabaseAuthGuard, OrgScopeGuard, RolesGuard] — see the comment on
  // OrgScoped in org-scoped.decorator.ts for why RolesGuard can't literally
  // sit between the other two.
  @Patch(':zoneId')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN)
  @OrgScoped('zoneId')
  update(
    @Param('zoneId') zoneId: string,
    @Body() updateZoneDto: UpdateZoneDto,
  ) {
    return this.zonesService.update(zoneId, updateZoneDto);
  }

  @Delete(':zoneId')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN)
  @OrgScoped('zoneId')
  remove(@Param('zoneId') zoneId: string) {
    return this.zonesService.remove(zoneId);
  }

  /**
   * Lives here rather than on BoothsController for the same reason
   * `VenuesController.createZone` does: OrgScopeGuard resolves the organization
   * only from a literal route param, so creating a booth under a zone has to be
   * `POST /zones/:zoneId/booths`, not `POST /booths` with zoneId in the body
   * (AGENTS.md §14.2).
   */
  @Post(':zoneId/booths')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN)
  @OrgScoped('zoneId')
  createBooth(
    @Param('zoneId') zoneId: string,
    @Body() createBoothDto: CreateBoothDto,
  ) {
    return this.boothsService.create(zoneId, createBoothDto);
  }
}
