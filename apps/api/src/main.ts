import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  // Locked to the deployed frontend when CORS_ORIGIN is set; otherwise left open
  // so local development works before apps/web exists (SCRUM-20).
  const corsOrigin = config.get<string>('CORS_ORIGIN');
  app.enableCors({ origin: corsOrigin ?? true });

  // whitelist strips undeclared fields and forbidNonWhitelisted rejects the
  // request outright (CLAUDE.md §14.4) — every request body needs a DTO.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  app.setGlobalPrefix('api');

  await app.listen(config.get<number>('PORT', 3000));
}
bootstrap();
