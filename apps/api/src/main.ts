import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { PrismaExceptionFilter } from './common/filters/prisma-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  // Locked to the deployed frontend when CORS_ORIGIN is set; otherwise left open
  // so local development works before apps/web exists (SCRUM-20).
  const corsOrigin = config.get<string>('CORS_ORIGIN');
  app.enableCors({ origin: corsOrigin ?? true });

  // whitelist strips undeclared fields and forbidNonWhitelisted rejects the
  // request outright (AGENTS.md §14.4) — every request body needs a DTO.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  // Prisma errors would otherwise surface as a 500 carrying Prisma's message,
  // which names tables and columns (AGENTS.md §14.5).
  app.useGlobalFilters(new PrismaExceptionFilter());

  app.setGlobalPrefix('api');

  await app.listen(config.get<number>('PORT', 3000));
}
// `void`, not a bare call: nothing can await the entry point, so the promise is
// deliberately unhandled and says so. A rejection here — a failed env
// validation, a port already in use — still surfaces as an unhandled rejection
// and stops the process, which is the correct outcome for a server that could
// not start.
void bootstrap();
