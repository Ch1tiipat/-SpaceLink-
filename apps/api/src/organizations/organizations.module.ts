import { Module } from '@nestjs/common';
import { AdminsController } from './admins.controller';
import { OrganizationsService } from './organizations.service';
import { OrganizationsController } from './organizations.controller';

@Module({
  controllers: [OrganizationsController, AdminsController],
  providers: [OrganizationsService],
})
export class OrganizationsModule {}
