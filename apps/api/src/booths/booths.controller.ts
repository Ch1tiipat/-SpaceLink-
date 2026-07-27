import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { SupabaseAuthGuard } from '../auth/guards/supabase-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { BoothsService } from './booths.service';

@Controller('booths')
@UseGuards(SupabaseAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN)
export class BoothsController {
  constructor(private readonly boothsService: BoothsService) {}

  @Get()
  findAll() {
    return this.boothsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.boothsService.findOne(id);
  }
}
