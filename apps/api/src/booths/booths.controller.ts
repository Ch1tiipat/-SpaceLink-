import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { OrgScoped } from '../auth/decorators/org-scoped.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { FindAllBoothsDto } from './dto/find-all-booths.dto';
import { UpdateBoothDto } from './dto/update-booth.dto';
import { BoothsService } from './booths.service';

@Controller('booths')
export class BoothsController {
  constructor(private readonly boothsService: BoothsService) {}

  // Public discovery reads — deliberately unguarded, see booths.controller.spec.ts.
  @Get()
  findAll(@Query() query: FindAllBoothsDto) {
    return this.boothsService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.boothsService.findOne(id);
  }

  // Mutation routes below. `@Roles` includes SUPER_ADMIN because OrgScopeGuard
  // already bypasses the membership check for that role — leaving it out here
  // would let a super admin pass OrgScopeGuard and then get wrongly rejected
  // by RolesGuard. Guard order note: this ordering resolves to
  // [SupabaseAuthGuard, OrgScopeGuard, RolesGuard] — see the comment on
  // OrgScoped in org-scoped.decorator.ts for why RolesGuard can't literally
  // sit between the other two.
  @Patch(':boothId')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN)
  @OrgScoped('boothId')
  update(
    @Param('boothId') boothId: string,
    @Body() updateBoothDto: UpdateBoothDto,
  ) {
    return this.boothsService.update(boothId, updateBoothDto);
  }

  @Delete(':boothId')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN)
  @OrgScoped('boothId')
  remove(@Param('boothId') boothId: string) {
    return this.boothsService.remove(boothId);
  }
}
