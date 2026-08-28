import { Module } from '@nestjs/common';
import { PlatformConfigController } from './platform-config.controller';
import { PlatformConfigService } from './platform-config.service';

@Module({
  controllers: [PlatformConfigController],
  providers: [PlatformConfigService],
})
export class PlatformConfigModule {}
