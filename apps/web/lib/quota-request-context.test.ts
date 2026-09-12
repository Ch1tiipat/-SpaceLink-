/* eslint-disable @typescript-eslint/no-require-imports -- Node runs this TypeScript test directly. */
const quotaContextAssert: typeof import('node:assert/strict') = require(
  'node:assert/strict'
);
const { test: quotaContextTest }: typeof import('node:test') = require('node:test');
const {
  parseQuotaRequestQuery,
  resolveQuotaRequestContext,
} = require('./quota-request-context.ts') as typeof import('./quota-request-context');
import type { EventMap, MyBooking } from './api';

const ids = {
  event: '22222222-2222-4222-8222-222222222222',
  zone: '88888888-8888-4888-8888-888888888888',
  booth: '33333333-3333-4333-8333-333333333333',
};
const query = { eventId: ids.event, zoneId: ids.zone, boothId: ids.booth };

function params(values: Record<string, string>) {
  return { get: (name: string) => values[name] ?? null };
}

function eventMap(availability: 'AVAILABLE' | 'BOOKED' = 'AVAILABLE'): EventMap {
  return {
    event: {
      id: ids.event,
      slug: 'event-test',
      name: 'งานทดสอบ',
    },
    zones: [
      {
        id: ids.zone,
        code: 'B',
        name: 'โซนแฟชั่น',
        booths: [
          {
            id: ids.booth,
            zoneId: ids.zone,
            code: 'B03',
            widthM: '3',
            heightM: '2.5',
            availability,
          },
        ],
      },
    ],
  } as EventMap;
}

const bookings = [
  {
    event: { id: ids.event },
    booth: { zone: { id: 'another-zone' } },
    status: 'CONFIRMED',
  },
] as MyBooking[];

quotaContextTest('parses a complete quota request and ignores a normal help visit', () => {
  quotaContextAssert.deepEqual(
    parseQuotaRequestQuery(
      params({
        type: 'QUOTA_INCREASE',
        eventId: ids.event,
        zoneId: ids.zone,
        boothId: ids.booth,
      }),
    ),
    { status: 'ready', value: { eventId: ids.event, zoneId: ids.zone, boothId: ids.booth } },
  );
  quotaContextAssert.deepEqual(parseQuotaRequestQuery(params({})), { status: 'none' });
});

quotaContextTest('rejects an incomplete quota request link', () => {
  quotaContextAssert.equal(
    parseQuotaRequestQuery(params({ type: 'QUOTA_INCREASE', eventId: ids.event })).status,
    'invalid',
  );
});

quotaContextTest('resolves a requested zone even when the active booking is in another zone', () => {
  const result = resolveQuotaRequestContext({
    query,
    eventMap: eventMap(),
    bookings,
  });

  quotaContextAssert.equal(result.status, 'ready');
  if (result.status === 'ready') {
    quotaContextAssert.equal(result.option.zoneName, 'โซนแฟชั่น');
    quotaContextAssert.equal(result.requestedBoothId, ids.booth);
  }
});

quotaContextTest('does not substitute another booth when the requested booth is no longer free', () => {
  const result = resolveQuotaRequestContext({
    query,
    eventMap: eventMap('BOOKED'),
    bookings,
  });

  quotaContextAssert.equal(result.status, 'ready');
  if (result.status === 'ready') {
    quotaContextAssert.equal(result.requestedBoothId, '');
    quotaContextAssert.match(result.notice ?? '', /ไม่ว่างแล้ว/);
  }
});

quotaContextTest('rejects a booth that does not belong to the requested zone', () => {
  const result = resolveQuotaRequestContext({
    query: { ...query, boothId: 'another-booth' },
    eventMap: eventMap(),
    bookings,
  });

  quotaContextAssert.equal(result.status, 'error');
});

quotaContextTest('rejects mismatched events and vendors without an active event booking', () => {
  quotaContextAssert.equal(
    resolveQuotaRequestContext({
      query: { ...query, eventId: 'another-event' },
      eventMap: eventMap(),
      bookings,
    }).status,
    'error',
  );
  quotaContextAssert.equal(
    resolveQuotaRequestContext({
      query,
      eventMap: eventMap(),
      bookings: [],
    }).status,
    'error',
  );
});
