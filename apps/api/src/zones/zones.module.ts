import { Module } from '@nestjs/common';
import { BoothsModule } from '../booths/booths.module';
import { ZonesService } from './zones.service';
import { ZonesController } from './zones.controller';

@Module({
  imports: [BoothsModule],
  controllers: [ZonesController],
  providers: [ZonesService],
  exports: [ZonesService],
})
export class ZonesModule {}
