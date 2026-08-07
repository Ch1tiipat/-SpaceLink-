import { Body, Controller, Patch, Post, UseGuards } from '@nestjs/common';
import { UserRole, type User } from '@prisma/client';
import { SupabaseAuthGuard } from '../auth/guards/supabase-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { CreateShopDto } from './dto/create-shop.dto';
import { UpdateShopDto } from './dto/update-shop.dto';
import { ShopsService } from './shops.service';

/**
 * Not org-scoped: a shop belongs to a vendor, not to an organization, so there
 * is no org id in either route and OrgScopeGuard has nothing to resolve. The
 * ownership check is the `ownerUserId` filter in ShopsService.
 */
@Controller('shops')
@UseGuards(SupabaseAuthGuard, RolesGuard)
@Roles(UserRole.VENDOR)
export class ShopsController {
  constructor(private readonly shopsService: ShopsService) {}

  @Post()
  create(
    @Body() createShopDto: CreateShopDto,
    @CurrentUser() currentUser: User,
  ) {
    return this.shopsService.create(createShopDto, currentUser.id);
  }

  @Patch('me')
  updateMe(
    @Body() updateShopDto: UpdateShopDto,
    @CurrentUser() currentUser: User,
  ) {
    return this.shopsService.updateMe(updateShopDto, currentUser.id);
  }
}
