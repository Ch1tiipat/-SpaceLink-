import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Liveness only — deliberately touches nothing but the process itself. */
  getStatus() {
    return {
      status: 'ok',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Readiness: the cheapest query that proves a connection can be opened.
   *
   * A failure here is expected while Supabase does not exist yet (CLAUDE.md
   * §12) — it is reported, never rethrown as-is. Prisma's message can name the
   * host and port it tried to reach, so only a fixed string reaches the client.
   */
  async checkDatabase() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'ok', database: 'up' };
    } catch (error) {
      this.logger.error(
        'Database health check failed',
        error instanceof Error ? error.stack : String(error),
      );
      throw new ServiceUnavailableException({
        status: 'error',
        database: 'down',
        message: 'Database is unavailable',
      });
    }
  }
}
