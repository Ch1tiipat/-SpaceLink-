import {
  ArgumentsHost,
  BadRequestException,
  Catch,
  ConflictException,
  ExceptionFilter,
  HttpException,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Response } from 'express';

type CaughtPrismaError =
  | Prisma.PrismaClientKnownRequestError
  | Prisma.PrismaClientInitializationError;

/**
 * Turns Prisma errors into ordinary HTTP responses.
 *
 * Prisma's own message names the table, column, and constraint that failed
 * (CLAUDE.md §14.5) — it is logged, never sent. The client gets a fixed string
 * built by the matching Nest exception class, so the body is identical in shape
 * to every other error the API returns: { statusCode, message, error }.
 *
 * Only the two Prisma classes below are caught; everything else keeps falling
 * through to Nest's default handler.
 */
@Catch(
  Prisma.PrismaClientKnownRequestError,
  Prisma.PrismaClientInitializationError,
)
export class PrismaExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(PrismaExceptionFilter.name);

  catch(exception: CaughtPrismaError, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    const httpException = this.toHttpException(exception);

    this.logger.error(
      `Prisma error -> HTTP ${httpException.getStatus()}: ${exception.message}`,
      exception.stack,
    );

    response.status(httpException.getStatus()).json(httpException.getResponse());
  }

  private toHttpException(exception: CaughtPrismaError): HttpException {
    if (exception instanceof Prisma.PrismaClientInitializationError) {
      return new ServiceUnavailableException('Database is unavailable');
    }

    switch (exception.code) {
      case 'P2025':
        return new NotFoundException('Resource not found');
      case 'P2002':
        return new ConflictException('Resource already exists');
      case 'P2003':
        return new BadRequestException('Related resource does not exist');
      default:
        return new InternalServerErrorException('Internal server error');
    }
  }
}
