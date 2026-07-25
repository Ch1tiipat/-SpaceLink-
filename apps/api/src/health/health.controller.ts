import { Controller, Get } from '@nestjs/common';
import { HealthService } from './health.service';

/**
 * Unauthenticated on purpose: these are the probes a host (Railway/Render)
 * calls before it has any token. Neither route returns anything about the
 * deployment beyond up/down.
 */
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  check() {
    return this.healthService.getStatus();
  }

  @Get('db')
  checkDatabase() {
    return this.healthService.checkDatabase();
  }
}
