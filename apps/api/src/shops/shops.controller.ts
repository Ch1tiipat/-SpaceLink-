import {
  BadRequestException,
  Body,
  Controller,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UserRole, type User } from '@prisma/client';
import { SupabaseAuthGuard } from '../auth/guards/supabase-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { CreateShopDto } from './dto/create-shop.dto';
import { UpdateShopDto } from './dto/update-shop.dto';
import {
  MAX_SHOP_LOGO_FILE_SIZE_BYTES,
  type UploadedShopLogoFile,
} from './shop-logo-storage.service';
import { ShopsService } from './shops.service';

export const SHOP_LOGO_UPLOAD_LIMITS = {
  files: 1,
  fields: 0,
  // Busboy emits `partsLimit` when the parsed part count reaches this value.
  // Two therefore permits the one expected file while rejecting a second part.
  parts: 2,
  fileSize: MAX_SHOP_LOGO_FILE_SIZE_BYTES,
} as const;

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

  /**
   * Multipart rather than a `logoUrl` in the JSON body: the API owns storage, so
   * the browser never holds the service-role key and never picks the object name
   * (§14.3, §14.4). Returns the same ShopResponse as the two routes above, with
   * `logoUrl` already pointing at the new file.
   */
  @Post('me/logo')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: SHOP_LOGO_UPLOAD_LIMITS,
    }),
  )
  uploadLogo(
    @UploadedFile() file: UploadedShopLogoFile | undefined,
    @CurrentUser() currentUser: User,
  ) {
    if (!file) {
      throw new BadRequestException('กรุณาแนบไฟล์โลโก้');
    }
    return this.shopsService.uploadLogo(file, currentUser.id);
  }
}
