/* eslint-disable @typescript-eslint/no-require-imports -- Node runs this TypeScript test directly. */
const homeFilterAssert: typeof import('node:assert/strict') = require(
  'node:assert/strict',
);
const { test: homeFilterTest }: typeof import('node:test') =
  require('node:test');
type DiscoveryEvent = import('./api').DiscoveryEvent;
const {
  buildHomeAreaFilterOptions,
  buildHomeEventFilterOptions,
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

homeFilterTest(
  'builds trimmed dropdown options without blanks or duplicates',
  () => {
    const duplicateAndBlankEvents = [
      ...events,
      makeHomeEvent({
        id: 'duplicate',
        name: '  SpaceLink Fair 2026  ',
        venue: {
          id: 'venue-duplicate',
          name: ' ลานกิจกรรมกลางเมือง ',
          address: ' อำเภอเมือง จังหวัดนครราชสีมา ',
        },
      }),
      makeHomeEvent({
        id: 'blank',
        name: '   ',
        venue: { id: 'venue-blank', name: '   ', address: '   ' },
      }),
    ];

    const eventOptions = buildHomeEventFilterOptions(duplicateAndBlankEvents);
    const areaOptions = buildHomeAreaFilterOptions(duplicateAndBlankEvents);

    homeFilterAssert.equal(
      eventOptions.filter(({ value }) => value === 'SpaceLink Fair 2026').length,
      1,
    );
    homeFilterAssert.equal(
      eventOptions.filter(({ value }) => value === 'ลานกิจกรรมกลางเมือง')
        .length,
      1,
    );
    homeFilterAssert.ok(eventOptions.every(({ value }) => value.length > 0));
    homeFilterAssert.equal(
      areaOptions.filter(({ value }) => value === 'นครราชสีมา').length,
      1,
    );
    homeFilterAssert.ok(areaOptions.every(({ value }) => value.length > 0));
  },
);

homeFilterTest(
  'applies all four dropdown values together and clears one filter at a time',
  () => {
    const selected = {
      query: 'Bangkok Creator Market',
      area: 'กรุงเทพมหานคร',
      categoryId: 'fashion',
      eventStatus: 'ongoing' as const,
    };

    homeFilterAssert.deepEqual(
      filterHomeEvents(events, selected, isBookableForTest, NOW).map(
        ({ id }) => id,
      ),
      ['ongoing'],
    );
    homeFilterAssert.deepEqual(
      filterHomeEvents(
        events,
        { ...selected, query: '' },
        isBookableForTest,
        NOW,
      ).map(({ id }) => id),
      ['ongoing'],
    );
    homeFilterAssert.equal(selected.area, 'กรุงเทพมหานคร');
    homeFilterAssert.equal(selected.categoryId, 'fashion');
    homeFilterAssert.equal(selected.eventStatus, 'ongoing');
  },
);

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
  'accepts free text with trimmed case-insensitive event and area matching',
  () => {
    homeFilterAssert.deepEqual(
      filterHomeEvents(
        events,
        { ...EMPTY_HOME_EVENT_FILTERS, query: '  spacelink FAIR  ' },
        isBookableForTest,
        NOW,
      ).map(({ id }) => id),
      ['future'],
    );
    homeFilterAssert.deepEqual(
      filterHomeEvents(
        events,
        { ...EMPTY_HOME_EVENT_FILTERS, area: '  นครราชสีมา  ' },
        isBookableForTest,
        NOW,
      ).map(({ id }) => id),
      ['future', 'ended'],
    );
    homeFilterAssert.deepEqual(
      filterHomeEvents(
        events,
        { ...EMPTY_HOME_EVENT_FILTERS, area: 'ศูนย์สร้างสรรค์' },
        isBookableForTest,
        NOW,
      ).map(({ id }) => id),
      ['ongoing'],
    );
  },
);

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
      ['future', 'ongoing'],
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
  'keeps status chips compatible with the other home discovery filters',
  () => {
    homeFilterAssert.deepEqual(
      filterHomeEvents(
        events,
        {
          ...EMPTY_HOME_EVENT_FILTERS,
          area: 'กรุงเทพมหานคร',
          categoryId: 'fashion',
          eventStatus: 'ongoing',
        },
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
          area: 'นครราชสีมา',
          categoryId: 'food',
          eventStatus: 'ended',
        },
        isBookableForTest,
        NOW,
      ).map(({ id }) => id),
      ['ended'],
    );
    homeFilterAssert.deepEqual(
      filterHomeEvents(
        events,
        EMPTY_HOME_EVENT_FILTERS,
        isBookableForTest,
        NOW,
      ).map(({ id }) => id),
      ['future', 'ongoing', 'ended'],
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
