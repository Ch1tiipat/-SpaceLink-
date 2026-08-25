import { Module } from '@nestjs/common';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { AdminsController } from './admins.controller';
import { OrganizationsService } from './organizations.service';
import { OrganizationsController } from './organizations.controller';

@Module({
  imports: [AuditLogsModule],
  controllers: [OrganizationsController, AdminsController],
  providers: [OrganizationsService],
})
export class OrganizationsModule {}
