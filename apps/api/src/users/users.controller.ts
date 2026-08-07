import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { UserRole, type User } from '@prisma/client';
import { SupabaseAuthGuard } from '../auth/guards/supabase-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { UpdateMeDto } from './dto/update-me.dto';
import { UsersService } from './users.service';

@Controller('users')
@UseGuards(SupabaseAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  findAll() {
    return this.usersService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  /**
   * The only non-admin route on this controller. `@Roles` must name all three
   * roles: it overrides the class-level `SUPER_ADMIN`, and RolesGuard resolves
   * with getAllAndOverride, so a shorter list here does not widen the class
   * default — it replaces it, and vendors would lose access to their own
   * profile. Asserted in users.controller.spec.ts.
   *
   * No `:id` — the target is the authenticated user (§14.2).
   */
  @Patch('me')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN, UserRole.VENDOR)
  updateMe(@Body() updateMeDto: UpdateMeDto, @CurrentUser() currentUser: User) {
    return this.usersService.updateMe(updateMeDto, currentUser.id);
  }
}
