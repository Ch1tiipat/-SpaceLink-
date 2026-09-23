/* eslint-disable @typescript-eslint/no-require-imports -- Node runs this TypeScript test directly. */
const homeFilterAssert: typeof import('node:assert/strict') = require(
  'node:assert/strict',
);
const { test: homeFilterTest }: typeof import('node:test') =
  require('node:test');
type DiscoveryEvent = import('./api').DiscoveryEvent;
const {
  EMPTY_HOME_EVENT_FILTERS,
  filterHomeEvents,
  provinceFromAddress,
} = require('./home-event-filters.ts') as typeof import('./home-event-filters');
const { hasEventEndCalendarDayPassed } =
  require('./event-time.ts') as typeof import('./event-time');

const isBookableForTest = (
  candidate: Pick<DiscoveryEvent, 'status' | 'endDate'>,
  now = new Date(),
) =>
  (candidate.status === 'PUBLISHED' || candidate.status === 'ONGOING') &&
  candidate.endDate.slice(0, 10) >= now.toISOString().slice(0, 10);

const NOW = new Date('2026-09-21T05:00:00.000Z');

function makeHomeEvent(
  overrides: Partial<DiscoveryEvent> & Pick<DiscoveryEvent, 'id' | 'name'>,
): DiscoveryEvent {
  return {
    slug: overrides.name.toLocaleLowerCase().replaceAll(' ', '-'),
    description: 'ตลาดสำหรับผู้ประกอบการท้องถิ่น',
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
    ...overrides,
  };
}

const events = [
  makeHomeEvent({ id: 'future', name: 'SpaceLink Fair 2026' }),
  makeHomeEvent({
    id: 'ongoing',
    name: 'Bangkok Creator Market',
    status: 'ONGOING',
    startDate: '2026-09-20T00:00:00.000Z',
    endDate: '2026-09-22T16:59:59.000Z',
    venue: {
      id: 'venue-2',
      name: 'ศูนย์สร้างสรรค์กรุงเทพ',
      address: 'กรุงเทพมหานคร',
    },
    categories: [{ id: 'fashion', name: 'แฟชั่น' }],
  }),
  makeHomeEvent({
    id: 'ended',
    name: 'Campus Market',
    status: 'COMPLETED',
    startDate: '2026-08-01T00:00:00.000Z',
    endDate: '2026-08-03T16:59:59.000Z',
  }),
];

homeFilterTest('extracts Thai provinces for filter options', () => {
  homeFilterAssert.equal(
    provinceFromAddress('อำเภอเมือง จังหวัดนครราชสีมา'),
    'นครราชสีมา',
  );
  homeFilterAssert.equal(
    provinceFromAddress('เขตปทุมวัน กรุงเทพมหานคร'),
    'กรุงเทพมหานคร',
  );
});

homeFilterTest('filters by event or venue text, area, and category', () => {
  homeFilterAssert.deepEqual(
    filterHomeEvents(
      events,
      { ...EMPTY_HOME_EVENT_FILTERS, query: 'สร้างสรรค์' },
      isBookableForTest,
      NOW,
    ).map(({ id }) => id),
    ['ongoing'],
  );
  homeFilterAssert.deepEqual(
    filterHomeEvents(
      events,
      {
        ...EMPTY_HOME_EVENT_FILTERS,
        area: 'กรุงเทพมหานคร',
        categoryId: 'fashion',
      },
      isBookableForTest,
      NOW,
    ).map(({ id }) => id),
    ['ongoing'],
  );
});

homeFilterTest(
  'filters bookable, ongoing, and ended events independently',
  () => {
    homeFilterAssert.deepEqual(
      filterHomeEvents(
        events,
        { ...EMPTY_HOME_EVENT_FILTERS, eventStatus: 'bookable' },
        isBookableForTest,
        NOW,
      ).map(({ id }) => id),
      ['future', 'ongoing'],
    );
    homeFilterAssert.deepEqual(
      filterHomeEvents(
        events,
        { ...EMPTY_HOME_EVENT_FILTERS, eventStatus: 'ongoing' },
        isBookableForTest,
        NOW,
      ).map(({ id }) => id),
      ['ongoing'],
    );
    homeFilterAssert.deepEqual(
      filterHomeEvents(
        events,
        { ...EMPTY_HOME_EVENT_FILTERS, eventStatus: 'ended' },
        isBookableForTest,
        NOW,
      ).map(({ id }) => id),
      ['ended'],
    );
    homeFilterAssert.equal(
      hasEventEndCalendarDayPassed(events[2].endDate, NOW),
      true,
    );
  },
);

homeFilterTest(
  'keeps an event ongoing through its final Bangkok calendar day',
  () => {
    const sameDayEnd = '2026-09-21T00:00:00.000Z';

    homeFilterAssert.equal(
      hasEventEndCalendarDayPassed(sameDayEnd, NOW),
      false,
    );
    homeFilterAssert.equal(
      hasEventEndCalendarDayPassed(
        sameDayEnd,
        new Date('2026-09-21T17:00:00.000Z'),
      ),
      true,
    );
  },
);
