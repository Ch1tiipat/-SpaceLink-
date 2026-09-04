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
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentOrgId } from '../common/decorators/current-org-id.decorator';
import { UpdateVenueDto } from './dto/update-venue.dto';
import { CreateZoneDto } from '../zones/dto/create-zone.dto';
import { ZonesService } from '../zones/zones.service';
import { FindAllVenuesDto } from './dto/find-all-venues.dto';
import { VenuesService } from './venues.service';

@Controller('venues')
export class VenuesController {
  constructor(
    private readonly venuesService: VenuesService,
    private readonly zonesService: ZonesService,
  ) {}

  // Public discovery reads — deliberately unguarded, see venues.controller.spec.ts.
  @Get()
  findAll(@Query() query: FindAllVenuesDto) {
    return this.venuesService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.venuesService.findOne(id);
  }

  // Same mutation guard chain as ZonesController: SupabaseAuthGuard,
  // OrgScopeGuard, RolesGuard. SUPER_ADMIN must pass both scope and role checks.
  @Patch(':venueId')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN)
  @OrgScoped('venueId')
  update(
    @Param('venueId') venueId: string,
    @Body() input: UpdateVenueDto,
    @CurrentOrgId() orgId: string,
  ) {
    return this.venuesService.update(venueId, input, orgId);
  }

  @Delete(':venueId')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN)
  @OrgScoped('venueId')
  remove(@Param('venueId') venueId: string, @CurrentOrgId() orgId: string) {
    return this.venuesService.remove(venueId, orgId);
  }

  /**
   * Lives here rather than on ZonesController because OrgScopeGuard resolves
   * the organization only from a literal route param — creating a zone under
   * a venue has to be `POST /venues/:venueId/zones`, not `POST /zones` with
   * venueId in the body (AGENTS.md §14.2).
   */
  @Post(':venueId/zones')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN)
  @OrgScoped('venueId')
  createZone(
    @Param('venueId') venueId: string,
    @Body() createZoneDto: CreateZoneDto,
  ) {
    return this.zonesService.create(venueId, createZoneDto);
  }
}
