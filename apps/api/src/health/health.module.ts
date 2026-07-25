import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';

// PrismaModule is not imported here — it is @Global(), so PrismaService injects
// into HealthService without it.
@Module({
  controllers: [HealthController],
  providers: [HealthService],
})
export class HealthModule {}
