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
const { isEventBookable } =
  require('./event-booking-rules.ts') as typeof import('./event-booking-rules');

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
  homeFilterAssert.equal(provinceFromAddress('นครราชสีมา'), 'นครราชสีมา');
  homeFilterAssert.equal(
    provinceFromAddress('ต.พลาง อ.เมือง นครราชสีมา'),
    'นครราชสีมา',
  );
  homeFilterAssert.equal(provinceFromAddress('จ.นครราชสีมา'), 'นครราชสีมา');
  homeFilterAssert.equal(
    provinceFromAddress(
      '45 ถนนนิมมานเหมินท์ อำเภอเมืองเชียงใหม่ จังหวัดเชียงใหม่ 50200',
    ),
    'เชียงใหม่',
  );
  homeFilterAssert.equal(provinceFromAddress('Bangkok'), 'กรุงเทพมหานคร');
  homeFilterAssert.equal(
    provinceFromAddress('Nakhon Ratchasima'),
    'นครราชสีมา',
  );
  homeFilterAssert.equal(
    provinceFromAddress('99 ถนนสุขุมวิท จังหวัดตาก 63000'),
    'ตาก',
  );
  homeFilterAssert.equal(provinceFromAddress('จ.น่าน'), 'น่าน');
  homeFilterAssert.equal(
    provinceFromAddress('111 ถนนมหาวิทยาลัย อำเภอเมือง'),
    '',
  );
});

homeFilterTest('extracts provinces from observed production venue addresses', () => {
  homeFilterAssert.equal(
    provinceFromAddress(
      'บ้านสันติสุข บ้านเลขที่ 23/2 อำเภอ นาเชือก มหาสารคาม 44170',
    ),
    'มหาสารคาม',
  );
  homeFilterAssert.equal(
    provinceFromAddress('มหาวิทยาลัยเทคโนโลยีสุรนารี นครราชสีมา'),
    'นครราชสีมา',
  );
});

homeFilterTest('does not infer ambiguous short provinces from larger words', () => {
  const falsePositiveAddresses = [
    '99 ถนนตากสิน เมือง',
    'ต.น่านฟ้า',
    'เดินทางเลยตลาดไปทางเหนือ',
    'ร้านตรังใจ',
    'ร้านแพร่ภาพชุมชน',
    'ถนนตราดใหม่',
    'โครงการยะลาใจ',
    'สตูลดอกไม้',
  ];

  for (const address of falsePositiveAddresses) {
    homeFilterAssert.equal(provinceFromAddress(address), '');
  }
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
    homeFilterAssert.equal(
      areaOptions.some(({ value }) => value === 'ลานกิจกรรมกลางเมือง'),
      false,
    );
    homeFilterAssert.equal(
      areaOptions.some(
        ({ value }) => value === 'อำเภอเมือง จังหวัดนครราชสีมา',
      ),
      false,
    );
    homeFilterAssert.deepEqual(
      areaOptions.map(({ value }) => value),
      ['นครราชสีมา', 'กรุงเทพมหานคร'],
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
      eventStatus: 'bookable' as const,
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
    homeFilterAssert.equal(selected.eventStatus, 'bookable');
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
      ['future'],
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

homeFilterTest('filters bookable and closed events independently', () => {
  const registrationClosed = makeHomeEvent({
    id: 'closed',
    name: 'Registration Closed',
    status: 'DRAFT',
  });
  const statusEvents = [...events, registrationClosed];

  homeFilterAssert.deepEqual(
    filterHomeEvents(
      statusEvents,
      { ...EMPTY_HOME_EVENT_FILTERS, eventStatus: 'bookable' },
      isBookableForTest,
      NOW,
    ).map(({ id }) => id),
    ['future', 'ongoing'],
  );
  homeFilterAssert.deepEqual(
    filterHomeEvents(
      statusEvents,
      { ...EMPTY_HOME_EVENT_FILTERS, eventStatus: 'closed' },
      isBookableForTest,
      NOW,
    ).map(({ id }) => id),
    ['closed'],
  );
  homeFilterAssert.equal(
    hasEventEndCalendarDayPassed(events[2].endDate, NOW),
    true,
  );
});

homeFilterTest(
  'keeps status chips compatible with the other home discovery filters',
  () => {
    const registrationClosed = makeHomeEvent({
      id: 'closed',
      name: 'Registration Closed',
      status: 'DRAFT',
    });

    homeFilterAssert.deepEqual(
      filterHomeEvents(
        events,
        {
          ...EMPTY_HOME_EVENT_FILTERS,
          area: 'กรุงเทพมหานคร',
          categoryId: 'fashion',
          eventStatus: 'bookable',
        },
        isBookableForTest,
        NOW,
      ).map(({ id }) => id),
      ['ongoing'],
    );
    homeFilterAssert.deepEqual(
      filterHomeEvents(
        [...events, registrationClosed],
        {
          ...EMPTY_HOME_EVENT_FILTERS,
          area: 'นครราชสีมา',
          categoryId: 'food',
          eventStatus: 'closed',
        },
        isBookableForTest,
        NOW,
      ).map(({ id }) => id),
      ['closed'],
    );
    homeFilterAssert.deepEqual(
      filterHomeEvents(
        events,
        EMPTY_HOME_EVENT_FILTERS,
        isBookableForTest,
        NOW,
      ).map(({ id }) => id),
      ['future', 'ongoing'],
    );
  },
);

homeFilterTest(
  'stably ranks bookable events before closed events and excludes ended events',
  () => {
    const closed = makeHomeEvent({
      id: 'closed',
      name: 'Registration Closed',
      status: 'DRAFT',
    });
    const secondBookable = makeHomeEvent({
      id: 'second-bookable',
      name: 'Second Bookable Event',
      status: 'ONGOING',
    });
    const source = [events[2], closed, events[1], events[0], secondBookable];

    homeFilterAssert.deepEqual(
      filterHomeEvents(
        source,
        EMPTY_HOME_EVENT_FILTERS,
        isBookableForTest,
        NOW,
      ).map(({ id }) => id),
      ['ongoing', 'future', 'second-bookable', 'closed'],
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

homeFilterTest('filters past events by Bangkok calendar day, including early ICT hours', () => {
  const calendarEvents = ['2026-10-03', '2026-10-04', '2026-10-05'].map(
    (day) => makeHomeEvent({
      id: day,
      name: `Market ${day}`,
      endDate: `${day}T00:00:00.000Z`,
    }),
  );

  for (const time of ['00:00:00', '00:30:00', '06:59:59', '07:00:00', '23:59:59']) {
    const now = new Date(`2026-10-04T${time}+07:00`);
    homeFilterAssert.deepEqual(
      filterHomeEvents(
        calendarEvents,
        { ...EMPTY_HOME_EVENT_FILTERS, eventStatus: 'past' },
        isEventBookable,
        now,
      ).map(({ id }) => id),
      ['2026-10-03'],
      time,
    );
    for (const eventStatus of ['all', 'bookable'] as const) {
      homeFilterAssert.deepEqual(
        filterHomeEvents(
          calendarEvents,
          { ...EMPTY_HOME_EVENT_FILTERS, eventStatus },
          isEventBookable,
          now,
        ).map(({ id }) => id),
        ['2026-10-04', '2026-10-05'],
        `${eventStatus} at ${time}`,
      );
    }
  }
});

homeFilterTest('moves the final day into past only at Bangkok midnight', () => {
  const finalDay = makeHomeEvent({
    id: 'final-day',
    name: 'Final Day Market',
    endDate: '2026-10-03T00:00:00.000Z',
    endTime: '09:00',
  });
  for (const [instant, expectedPast] of [
    ['2026-10-03T23:59:59.999+07:00', false],
    ['2026-10-04T00:00:00.000+07:00', true],
  ] as const) {
    const now = new Date(instant);
    homeFilterAssert.equal(
      filterHomeEvents(
        [finalDay],
        { ...EMPTY_HOME_EVENT_FILTERS, eventStatus: 'past' },
        isEventBookable,
        now,
      ).length,
      expectedPast ? 1 : 0,
    );
    homeFilterAssert.equal(isEventBookable(finalDay, now), !expectedPast);
    homeFilterAssert.equal(
      filterHomeEvents([finalDay], EMPTY_HOME_EVENT_FILTERS, isEventBookable, now).length,
      expectedPast ? 0 : 1,
    );
  }
});

homeFilterTest('combines past with query, area and category filters', () => {
  const pastEvents = [
    makeHomeEvent({ id: 'matching', name: 'Campus Market', endDate: '2026-08-03T00:00:00.000Z' }),
    makeHomeEvent({ id: 'other-name', name: 'City Fair', endDate: '2026-08-03T00:00:00.000Z' }),
    makeHomeEvent({
      id: 'other-area', name: 'Campus Market', endDate: '2026-08-03T00:00:00.000Z',
      venue: { id: 'other-venue', name: 'Bangkok Venue', address: 'กรุงเทพมหานคร' },
    }),
    makeHomeEvent({
      id: 'other-category', name: 'Campus Market', endDate: '2026-08-03T00:00:00.000Z',
      categories: [{ id: 'fashion', name: 'แฟชั่น' }],
    }),
    makeHomeEvent({ id: 'future-match', name: 'Campus Market' }),
  ];
  const selected = {
    query: '  CAMPUS  ',
    area: ' นครราชสีมา ',
    categoryId: 'food',
    eventStatus: 'past' as const,
  };
  homeFilterAssert.deepEqual(
    filterHomeEvents(pastEvents, selected, isEventBookable, NOW).map(({ id }) => id),
    ['matching'],
  );
  homeFilterAssert.deepEqual(
    filterHomeEvents(
      pastEvents,
      { ...selected, query: 'ลานกิจกรรมกลางเมือง' },
      isEventBookable,
      NOW,
    ).map(({ id }) => id),
    ['matching', 'other-name'],
  );
});

homeFilterTest('sorts past events newest first with stable ties without mutating input', () => {
  const source = [
    makeHomeEvent({ id: 'older', name: 'Older', endDate: '2026-08-01T00:00:00.000Z' }),
    makeHomeEvent({ id: 'latest-first', name: 'Latest First', endDate: '2026-09-20T00:00:00.000Z' }),
    makeHomeEvent({ id: 'middle', name: 'Middle', endDate: '2026-09-01T00:00:00.000Z' }),
    makeHomeEvent({ id: 'latest-second', name: 'Latest Second', endDate: '2026-09-20T00:00:00.000Z' }),
  ];
  const originalOrder = source.map(({ id }) => id);
  homeFilterAssert.deepEqual(
    filterHomeEvents(
      source,
      { ...EMPTY_HOME_EVENT_FILTERS, eventStatus: 'past' },
      isEventBookable,
      NOW,
    ).map(({ id }) => id),
    ['latest-first', 'latest-second', 'middle', 'older'],
  );
  homeFilterAssert.deepEqual(source.map(({ id }) => id), originalOrder);
});

homeFilterTest('keeps existing status filters unchanged and past has no bookable featured event', () => {
  const source = [
    makeHomeEvent({ id: 'closed', name: 'Closed', status: 'DRAFT' }),
    makeHomeEvent({ id: 'past', name: 'Past', status: 'ONGOING', endDate: '2026-09-20T00:00:00.000Z' }),
    makeHomeEvent({ id: 'bookable', name: 'Bookable' }),
    makeHomeEvent({ id: 'invalid-date', name: 'Invalid Date', endDate: '' }),
  ];
  const expected = {
    all: ['bookable', 'closed', 'invalid-date'],
    bookable: ['bookable'],
    closed: ['closed', 'invalid-date'],
    past: ['past'],
  };
  for (const eventStatus of ['all', 'bookable', 'closed', 'past'] as const) {
    const visible = filterHomeEvents(
      source,
      { ...EMPTY_HOME_EVENT_FILTERS, eventStatus },
      isEventBookable,
      NOW,
    );
    homeFilterAssert.deepEqual(visible.map(({ id }) => id), expected[eventStatus]);
    if (eventStatus === 'past' || eventStatus === 'closed') {
      homeFilterAssert.equal(visible.find((event) => isEventBookable(event, NOW)), undefined);
    }
  }
});

