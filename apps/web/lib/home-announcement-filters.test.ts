/* eslint-disable @typescript-eslint/no-require-imports -- Node runs this TypeScript test directly. */
const announcementFilterAssert: typeof import('node:assert/strict') = require('node:assert/strict');
const {
  test: announcementFilterTest,
}: typeof import('node:test') = require('node:test');
type AdminAnnouncement = import('./api').AdminAnnouncement;
const { filterHomeAnnouncements, resolveAnnouncementLoad } =
  require('./home-announcement-filters.ts') as typeof import('./home-announcement-filters');

function makeAnnouncement(
  overrides: Partial<AdminAnnouncement> &
    Pick<AdminAnnouncement, 'id' | 'type'>,
): AdminAnnouncement {
  return {
    organizationId: 'org-1',
    eventId: null,
    title: 'ประกาศจากผู้จัดงาน',
    body: 'รายละเอียดประกาศ',
    isActive: true,
    publishedAt: null,
    createdAt: '2026-09-26T00:00:00.000Z',
    updatedAt: '2026-09-26T00:00:00.000Z',
    ...overrides,
  };
}

const announcements = [
  makeAnnouncement({
    id: 'event-announcement',
    type: 'EVENT',
    title: 'กำหนดการ Event เดือนตุลาคม',
  }),
  makeAnnouncement({
    id: 'general-announcement',
    type: 'ANNOUNCEMENT',
    title: 'ประกาศระบบทั่วไป',
  }),
  makeAnnouncement({
    id: 'keyword-trap',
    type: 'ANNOUNCEMENT',
    title: 'ข่าว Event ที่ยังเป็นประกาศทั่วไป',
  }),
];

announcementFilterTest('shows every announcement by default', () => {
  announcementFilterAssert.deepEqual(
    filterHomeAnnouncements(announcements, 'all').map(({ id }) => id),
    ['event-announcement', 'general-announcement', 'keyword-trap'],
  );
});

announcementFilterTest(
  'filters Event cards using the persisted type only',
  () => {
    announcementFilterAssert.deepEqual(
      filterHomeAnnouncements(announcements, 'EVENT').map(({ id }) => id),
      ['event-announcement'],
    );
  },
);

announcementFilterTest(
  'preserves fulfilled announcements on a partial load failure',
  () => {
    const result = resolveAnnouncementLoad([
      { status: 'fulfilled', value: [announcements[0]] },
      { status: 'rejected', reason: new Error('network down') },
    ]);

    announcementFilterAssert.equal(result.status, 'partial-error');
    announcementFilterAssert.deepEqual(
      result.items.map(({ id }) => id),
      ['event-announcement'],
    );
  },
);

announcementFilterTest(
  'reports an error when every announcement request fails',
  () => {
    const result = resolveAnnouncementLoad([
      { status: 'rejected', reason: new Error('first organization failed') },
      { status: 'rejected', reason: new Error('second organization failed') },
    ]);

    announcementFilterAssert.equal(result.status, 'error');
    announcementFilterAssert.deepEqual(result.items, []);
  },
);

announcementFilterTest(
  'filters general announcements using the persisted type only',
  () => {
    announcementFilterAssert.deepEqual(
      filterHomeAnnouncements(announcements, 'ANNOUNCEMENT').map(
        ({ id }) => id,
      ),
      ['general-announcement', 'keyword-trap'],
    );
  },
);
