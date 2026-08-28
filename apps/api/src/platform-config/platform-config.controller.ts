import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { RolesGuard } from '../auth/guards/roles.guard';
import { SupabaseAuthGuard } from '../auth/guards/supabase-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UpdatePlatformConfigDto } from './dto/update-platform-config.dto';
import { PlatformConfigService } from './platform-config.service';

@Controller('platform-config')
@UseGuards(SupabaseAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN)
export class PlatformConfigController {
  constructor(private readonly platformConfigService: PlatformConfigService) {}

  @Get()
  findBillingConfig() {
    return this.platformConfigService.findBillingConfig();
  }

  @Patch()
  updateBillingConfig(@Body() input: UpdatePlatformConfigDto) {
    return this.platformConfigService.updateBillingConfig(input);
  }
}
