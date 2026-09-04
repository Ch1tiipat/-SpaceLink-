import { Module } from '@nestjs/common';
import { OrganizationVenuesController } from '../organizations/organization-venues.controller';
import { ZonesModule } from '../zones/zones.module';
import { VenuesService } from './venues.service';
import { VenuesController } from './venues.controller';

@Module({
  imports: [ZonesModule],
  controllers: [VenuesController, OrganizationVenuesController],
  providers: [VenuesService],
})
export class VenuesModule {}
