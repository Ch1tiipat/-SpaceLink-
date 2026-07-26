import { Logger, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { HealthService } from './health.service';

const UP = { status: 'ok', database: 'up' };

/**
 * Declared here rather than imported from the service, so that shortening the
 * window is a visible change to this file too.
 */
const CACHE_TTL_MS = 10_000;

/**
 * The whole point of the cache is that `$queryRaw` is NOT called — every
 * assertion here is ultimately a call count on this mock. DATABASE_URL allows
 * one connection (AGENTS.md §9), so an unauthenticated probe that queries on
 * every hit competes with real traffic for it.
 */
describe('HealthService', () => {
  let queryRaw: jest.Mock;
  let service: HealthService;
  let logError: jest.SpyInstance;

  beforeEach(() => {
    // Fake timers so the 10s window can be crossed without waiting 10s.
    // Promises still settle normally — only the clock is frozen.
    jest.useFakeTimers();

    queryRaw = jest.fn().mockResolvedValue([{ '?column?': 1 }]);
    service = new HealthService({
      $queryRaw: queryRaw,
    } as unknown as PrismaService);

    logError = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.useRealTimers();
    logError.mockRestore();
  });

  it('opens one connection for two calls inside the window', async () => {
    await expect(service.checkDatabase()).resolves.toEqual(UP);

    jest.advanceTimersByTime(9_000);

    // Same answer, and no second query behind it.
    await expect(service.checkDatabase()).resolves.toEqual(UP);
    expect(queryRaw).toHaveBeenCalledTimes(1);
  });

  it('queries again once the window has passed', async () => {
    await service.checkDatabase();

    jest.advanceTimersByTime(CACHE_TTL_MS);

    await expect(service.checkDatabase()).resolves.toEqual(UP);
    expect(queryRaw).toHaveBeenCalledTimes(2);
  });

  /*
   * The case that matters most. A down database is the one that must not be
   * re-dialled per request: each attempt costs a connection and a timeout, so
   * an uncached failure turns an outage into a queue of them.
   */
  it('caches a failure, so a down database is not probed on every request', async () => {
    queryRaw.mockRejectedValue(new Error("Can't reach database server"));

    await expect(service.checkDatabase()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    await expect(service.checkDatabase()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );

    expect(queryRaw).toHaveBeenCalledTimes(1);
    // Logged once per window, not once per request — a probe every 5s from a
    // host would otherwise fill the log with the same stack trace.
    expect(logError).toHaveBeenCalledTimes(1);

    // And the failure expires like a success does, so recovery is noticed.
    jest.advanceTimersByTime(CACHE_TTL_MS);
    queryRaw.mockResolvedValue([{ '?column?': 1 }]);

    await expect(service.checkDatabase()).resolves.toEqual(UP);
    expect(queryRaw).toHaveBeenCalledTimes(2);
  });

  /*
   * The cache only fills once a probe RETURNS, so requests that arrive while
   * the first is still open would each start their own — precisely the burst
   * the cache exists to prevent, and the one a cold start actually produces.
   */
  it('shares one query between calls that arrive before the first returns', async () => {
    let release: (rows: unknown[]) => void = () => undefined;
    queryRaw.mockReturnValue(
      new Promise((resolve) => {
        release = resolve;
      }),
    );

    const both = Promise.all([
      service.checkDatabase(),
      service.checkDatabase(),
    ]);
    release([{ '?column?': 1 }]);

    await expect(both).resolves.toEqual([UP, UP]);
    expect(queryRaw).toHaveBeenCalledTimes(1);
  });

  // /api/health is liveness only: it answers while the database is unreachable,
  // which is the current state of this project (AGENTS.md §12).
  it('answers the liveness probe without touching the database', () => {
    expect(service.getStatus()).toMatchObject({ status: 'ok' });
    expect(queryRaw).not.toHaveBeenCalled();
  });
});
