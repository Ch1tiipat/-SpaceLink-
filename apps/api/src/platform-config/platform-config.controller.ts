import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import type { User } from '@prisma/client';
import { RolesGuard } from '../auth/guards/roles.guard';
import { SupabaseAuthGuard } from '../auth/guards/supabase-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
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
  updateBillingConfig(
    @Body() input: UpdatePlatformConfigDto,
    @CurrentUser() currentUser: User,
  ) {
    return this.platformConfigService.updateBillingConfig(
      input,
      currentUser.id,
    );
  }
}
