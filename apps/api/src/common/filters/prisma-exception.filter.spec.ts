import { type ArgumentsHost, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaExceptionFilter } from './prisma-exception.filter';

const SENSITIVE_MESSAGE = 'password=top-secret database.internal';
const SENSITIVE_STACK = `Prisma failure: ${SENSITIVE_MESSAGE}`;
const SENSITIVE_META = 'private_constraint_name';
const SENSITIVE_CLIENT_VERSION = 'sensitive-client-version';
const SENSITIVE_INITIALIZATION_CODE = 'sensitive-initialization-code';

type ResponseMock = {
  status: jest.Mock;
  json: jest.Mock;
};

function createHost(): { host: ArgumentsHost; response: ResponseMock } {
  const response: ResponseMock = {
    status: jest.fn(),
    json: jest.fn(),
  };
  response.status.mockReturnValue(response);

  const host = {
    switchToHttp: () => ({ getResponse: () => response }),
  } as unknown as ArgumentsHost;

  return { host, response };
}

function knownError(code: string, message = 'Prisma request failed') {
  return new Prisma.PrismaClientKnownRequestError(message, {
    code,
    clientVersion: 'test',
  });
}

describe('PrismaExceptionFilter', () => {
  let filter: PrismaExceptionFilter;
  let logError: jest.SpyInstance;

  beforeEach(() => {
    logError = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    filter = new PrismaExceptionFilter();
  });

  afterEach(() => {
    logError.mockRestore();
  });

  it('logs only the known error type, Prisma code, and HTTP status', () => {
    const error = new Prisma.PrismaClientKnownRequestError(SENSITIVE_MESSAGE, {
      code: 'P2002',
      clientVersion: SENSITIVE_CLIENT_VERSION,
      meta: { target: SENSITIVE_META },
    });
    error.stack = SENSITIVE_STACK;
    const { host } = createHost();

    filter.catch(error, host);

    expect(logError).toHaveBeenCalledTimes(1);
    expect(logError).toHaveBeenCalledWith(
      'Prisma error -> HTTP 409; type=PrismaClientKnownRequestError; code=P2002',
    );
    const logged = logError.mock.calls.flat().join(' ');
    expect(logged).not.toContain(SENSITIVE_MESSAGE);
    expect(logged).not.toContain(SENSITIVE_STACK);
    expect(logged).not.toContain(SENSITIVE_META);
    expect(logged).not.toContain(SENSITIVE_CLIENT_VERSION);
  });

  it.each([
    [
      'P2025',
      404,
      { statusCode: 404, message: 'Resource not found', error: 'Not Found' },
    ],
    [
      'P2002',
      409,
      {
        statusCode: 409,
        message: 'Resource already exists',
        error: 'Conflict',
      },
    ],
    [
      'P2003',
      400,
      {
        statusCode: 400,
        message: 'Related resource does not exist',
        error: 'Bad Request',
      },
    ],
    [
      'P9999',
      500,
      {
        statusCode: 500,
        message: 'Internal server error',
        error: 'Internal Server Error',
      },
    ],
  ])('keeps the %s HTTP mapping unchanged', (code, status, body) => {
    const { host, response } = createHost();

    filter.catch(knownError(code), host);

    expect(response.status).toHaveBeenCalledWith(status);
    expect(response.json).toHaveBeenCalledWith(body);
  });

  it('keeps the initialization-error mapping without logging its details', () => {
    const error = new Prisma.PrismaClientInitializationError(
      SENSITIVE_MESSAGE,
      SENSITIVE_CLIENT_VERSION,
      SENSITIVE_INITIALIZATION_CODE,
    );
    error.stack = SENSITIVE_STACK;
    const { host, response } = createHost();

    filter.catch(error, host);

    expect(response.status).toHaveBeenCalledWith(503);
    expect(response.json).toHaveBeenCalledWith({
      statusCode: 503,
      message: 'Database is unavailable',
      error: 'Service Unavailable',
    });
    expect(logError).toHaveBeenCalledTimes(1);
    expect(logError).toHaveBeenCalledWith(
      'Prisma error -> HTTP 503; type=PrismaClientInitializationError',
    );
    const logged = logError.mock.calls.flat().join(' ');
    expect(logged).not.toContain(SENSITIVE_MESSAGE);
    expect(logged).not.toContain(SENSITIVE_STACK);
    expect(logged).not.toContain(SENSITIVE_CLIENT_VERSION);
    expect(logged).not.toContain(SENSITIVE_INITIALIZATION_CODE);
  });
});
