/* eslint-disable @typescript-eslint/no-require-imports -- Node runs this TypeScript test directly. */
const savedEventsAssert: typeof import('node:assert/strict') = require(
  'node:assert/strict',
);
const { test: savedEventsTest }: typeof import('node:test') =
  require('node:test');
type SavedDiscoveryEvent = import('./api').DiscoveryEvent;
const { resolveSavedEvents, withoutSavedEvent } = require(
  './saved-events.ts',
) as typeof import('./saved-events');

function makeSavedEvent(id: string, name: string): SavedDiscoveryEvent {
  return {
    id,
    slug: name.toLocaleLowerCase().replaceAll(' ', '-'),
    name,
    description: 'รายละเอียดงาน',
    status: 'PUBLISHED',
    startDate: '2026-10-01T00:00:00.000Z',
    endDate: '2026-10-03T16:59:59.000Z',
    startTime: '09:00',
    endTime: '20:00',
    bannerUrl: null,
    galleryUrls: [],
    organization: { id: 'org-1', name: 'SpaceLink', logoUrl: null },
    venue: {
      id: 'venue-1',
      name: 'ลานกิจกรรมกลางเมือง',
      address: 'อำเภอเมือง จังหวัดนครราชสีมา',
    },
    categories: [{ id: 'food', name: 'อาหารและเครื่องดื่ม' }],
  };
}

const savedEventFixtures = [
  makeSavedEvent('event-1', 'SpaceLink Fair'),
  makeSavedEvent('event-2', 'Creative Market'),
];

savedEventsTest('resolves saved events in API order', () => {
  savedEventsAssert.deepEqual(
    resolveSavedEvents(savedEventFixtures, ['event-2', 'event-1']).map(
      ({ id }) => id,
    ),
    ['event-2', 'event-1'],
  );
});

savedEventsTest('skips missing and duplicate saved event ids safely', () => {
  savedEventsAssert.deepEqual(
    resolveSavedEvents(
      savedEventFixtures,
      ['missing', 'event-1', 'event-1'],
    ).map(({ id }) => id),
    ['event-1'],
  );
});

savedEventsTest('removes only the selected saved event id', () => {
  savedEventsAssert.deepEqual(
    withoutSavedEvent(['event-1', 'event-2'], 'event-1'),
    ['event-2'],
  );
});
