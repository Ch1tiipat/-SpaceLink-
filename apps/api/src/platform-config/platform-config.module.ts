import { Module } from '@nestjs/common';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { PlatformConfigController } from './platform-config.controller';
import { PlatformConfigService } from './platform-config.service';

@Module({
  imports: [AuditLogsModule],
  controllers: [PlatformConfigController],
  providers: [PlatformConfigService],
})
export class PlatformConfigModule {}
