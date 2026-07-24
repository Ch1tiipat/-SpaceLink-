import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * Prisma connects lazily — on the first query, by itself.
 *
 * There is deliberately no `onModuleInit()` and no `$connect()` call: eager
 * connecting would make the whole application fail to boot whenever the
 * database is unreachable. The server must start with no database; a query
 * then fails with a clear error at request time.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  async onModuleDestroy() {
    await this.$disconnect();
  }
}
