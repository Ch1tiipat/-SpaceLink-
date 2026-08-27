import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { UserRole, type User } from '@prisma/client';
import { SupabaseAuthGuard } from '../auth/guards/supabase-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { CreateSystemBroadcastDto } from './dto/create-system-broadcast.dto';
import { SystemBroadcastsService } from './system-broadcasts.service';

@Controller('system-broadcasts')
@UseGuards(SupabaseAuthGuard, RolesGuard)
export class SystemBroadcastsController {
  constructor(
    private readonly systemBroadcastsService: SystemBroadcastsService,
  ) {}

  @Post()
  @Roles(UserRole.SUPER_ADMIN)
  create(
    @CurrentUser() currentUser: User,
    @Body() input: CreateSystemBroadcastDto,
  ) {
    return this.systemBroadcastsService.create(currentUser.id, input);
  }

  @Get('active')
  findActive() {
    return this.systemBroadcastsService.findActive();
  }
}
