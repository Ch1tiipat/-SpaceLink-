import { Module } from '@nestjs/common';
import { ZonesModule } from '../zones/zones.module';
import { VenuesService } from './venues.service';
import { VenuesController } from './venues.controller';

@Module({
  imports: [ZonesModule],
  controllers: [VenuesController],
  providers: [VenuesService],
})
export class VenuesModule {}
