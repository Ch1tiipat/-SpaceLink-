import { Module } from '@nestjs/common';
import { ZonesService } from './zones.service';
import { ZonesController } from './zones.controller';

@Module({
  controllers: [ZonesController],
  providers: [ZonesService],
})
export class ZonesModule {}
