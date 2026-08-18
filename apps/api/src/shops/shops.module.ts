import { Module } from '@nestjs/common';
import { ShopLogoStorageService } from './shop-logo-storage.service';
import { ShopsService } from './shops.service';
import { ShopsController } from './shops.controller';

@Module({
  controllers: [ShopsController],
  providers: [ShopsService, ShopLogoStorageService],
  exports: [ShopsService],
})
export class ShopsModule {}
