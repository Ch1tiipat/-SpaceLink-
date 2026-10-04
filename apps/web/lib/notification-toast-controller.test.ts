/* eslint-disable @typescript-eslint/no-require-imports -- Node runs this TypeScript test directly. */
const toastAssert: typeof import('node:assert/strict') = require('node:assert/strict');
const { test: toastTest }: typeof import('node:test') = require('node:test');
const { createNotificationToastController: createToastController, notificationToastHref: toastHref } =
  require('./notification-toast-controller.ts') as typeof import('./notification-toast-controller');
type ToastTestRow = import('./notification-toast-controller').ToastNotification;
type ToastTestCard = import('./notification-toast-controller').NotificationToast;

function toastRow(id: string, overrides: Partial<ToastTestRow> = {}): ToastTestRow {
  return { id, title: `แจ้งเตือน ${id}`, body: 'รายละเอียดทดสอบ', type: 'SYSTEM',
    createdAt: new Date(0).toISOString(), relatedEntityId: null, relatedEntityType: null, ...overrides };
}
function toastHarness() {
  let time = 100_000;
  let counter = 0;
  const timers = new Map<number, { at: number; callback: () => void }>();
  const state: { cards: ToastTestCard[]; rows: ToastTestRow[];
    broadcast: import('./notification-toast-controller').ToastBroadcast | null; fail: boolean } =
    { cards: [], rows: [], broadcast: null, fail: false };
  const controller = createToastController({
    now: () => time,
    fetchSnapshot: async () => {
      if (state.fail) throw new Error('unavailable');
      return { notifications: state.rows, broadcast: state.broadcast };
    },
    onChange: (cards) => { state.cards = cards; },
    setTimeout(callback, delay) { const id = ++counter; timers.set(id, { at: time + delay, callback }); return id; },
    clearTimeout(handle) { timers.delete(handle as number); },
  });
  function advance(ms: number) {
    const target = time + ms;
    while (true) {
      const entry = [...timers.entries()].filter(([, timer]) => timer.at <= target).sort((a, b) => a[1].at - b[1].at)[0];
      if (!entry) break;
      const [id, timer] = entry;
      timers.delete(id); time = timer.at; timer.callback();
    }
    time = target;
  }
  controller.setAccount('account-A');
  return { controller, state, advance, timers };
}

toastTest('baseline does not replay history; simultaneous arrivals stack chronologically and expire exactly at 60 seconds', async () => {
  const h = toastHarness();
  h.state.rows = [toastRow('history')];
  await h.controller.refresh();
  toastAssert.equal(h.state.cards.length, 0);
  h.state.rows = [toastRow('b', { createdAt: new Date(120_000).toISOString() }), toastRow('a', { createdAt: new Date(110_000).toISOString() }), toastRow('history')];
  await h.controller.refresh();
  toastAssert.deepEqual(h.state.cards.map((card) => card.id), ['a', 'b']);
  h.advance(59_999);
  toastAssert.equal(h.state.cards.length, 2);
  await h.controller.refresh(); // Polling must not restart either expiry.
  h.advance(1);
  toastAssert.equal(h.state.cards.length, 0);
  await h.controller.refresh();
  toastAssert.equal(h.state.cards.length, 0);
  h.controller.dispose();
});

toastTest('later arrivals keep their own full minute and manual dismissal does not replay', async () => {
  const h = toastHarness();
  await h.controller.refresh();
  h.state.rows = [toastRow('a')]; await h.controller.refresh();
  h.advance(20_000);
  h.state.rows = [toastRow('b'), toastRow('a')]; await h.controller.refresh();
  h.advance(40_000);
  toastAssert.deepEqual(h.state.cards.map((card) => card.id), ['b']);
  h.advance(19_999); toastAssert.equal(h.state.cards.length, 1);
  h.advance(1); toastAssert.equal(h.state.cards.length, 0);
  h.state.rows.push(toastRow('c')); await h.controller.refresh();
  h.controller.dismiss('c'); await h.controller.refresh();
  toastAssert.equal(h.state.cards.length, 0);
  toastAssert.equal(h.state.rows.length, 3, 'dismissal never deletes API history');
  h.controller.dispose();
});

toastTest('push identity authorizes through the current API, ignores foreign IDs, and deduplicates with polling', async () => {
  const h = toastHarness();
  h.state.rows = [toastRow('review', { relatedEntityType: 'BOOKING_REVIEW', relatedEntityId: 'booking-1' })];
  h.controller.push('review'); await h.controller.refresh();
  toastAssert.equal(h.state.cards[0].href, '/bookings/booking-1/review');
  h.controller.push('review'); h.controller.push('foreign-notification'); await h.controller.refresh();
  toastAssert.equal(h.state.cards.length, 1);
  h.controller.dispose();
});

toastTest('broadcast and its SYSTEM fanout row show one card and do not reappear after expiry', async () => {
  const h = toastHarness();
  h.state.broadcast = { id: 'broadcast-1', title: 'ประกาศ', body: 'ข้อความ' };
  h.state.rows = [toastRow('broadcast-row', { title: 'ประกาศ', body: 'ข้อความ' })];
  await h.controller.refresh();
  toastAssert.deepEqual(h.state.cards.map((card) => card.id), ['broadcast:broadcast-1']);
  h.advance(60_000); await h.controller.refresh();
  toastAssert.equal(h.state.cards.length, 0);
  h.state.broadcast = { id: 'broadcast-2', title: 'ใหม่', body: 'ข้อความ' };
  await h.controller.refresh(); toastAssert.equal(h.state.cards.length, 1);
  h.state.broadcast = null; await h.controller.refresh(); toastAssert.equal(h.state.cards.length, 0);
  h.controller.dispose();
});

toastTest('API unavailable, logout and dispose clear private cards and timers', async () => {
  const h = toastHarness();
  await h.controller.refresh(); h.state.rows = [toastRow('a')]; await h.controller.refresh();
  h.state.fail = true; await h.controller.refresh();
  toastAssert.equal(h.state.cards.length, 0); toastAssert.equal(h.timers.size, 0);
  h.state.fail = false; h.state.rows.push(toastRow('b')); await h.controller.refresh();
  toastAssert.equal(h.state.cards.length, 1);
  h.controller.setAccount(null);
  toastAssert.equal(h.state.cards.length, 0); toastAssert.equal(h.timers.size, 0);
  h.controller.dispose(); h.controller.push('a'); await h.controller.refresh();
  toastAssert.equal(h.state.cards.length, 0);
});

toastTest('account switch aborts stale work even if the network ignores abort, and creates a fresh baseline', async () => {
  const requests: Array<{ owner: string; signal: AbortSignal;
    resolve: (snapshot: { notifications: ToastTestRow[]; broadcast: null }) => void }> = [];
  let cards: ToastTestCard[] = [];
  const controller = createToastController({ now: () => 100_000,
    fetchSnapshot: (owner, signal) => new Promise((resolve) => requests.push({ owner, signal, resolve })),
    onChange: (next) => { cards = next; }, setTimeout: () => 1, clearTimeout: () => undefined });
  controller.setAccount('A'); const old = controller.refresh();
  controller.setAccount('B'); const fresh = controller.refresh();
  toastAssert.equal(requests[0].signal.aborted, true);
  requests[1].resolve({ notifications: [toastRow('B-history')], broadcast: null }); await fresh;
  requests[0].resolve({ notifications: [toastRow('A-private', { createdAt: new Date(110_000).toISOString() })], broadcast: null }); await old;
  toastAssert.deepEqual(cards, []);
  controller.dispose();
});

toastTest('routing uses only supported relative routes and encodes related IDs', () => {
  toastAssert.equal(toastHref(toastRow('1', { type: 'SUPPORT_TICKET' })), '/support');
  toastAssert.equal(toastHref(toastRow('1', { relatedEntityType: 'REFUND_REQUEST', relatedEntityId: 'a b' })), '/refunds?refundId=a%20b');
  toastAssert.equal(toastHref(toastRow('1', { relatedEntityType: 'BOOKING_REVIEW', relatedEntityId: '../other' })), '/bookings/..%2Fother/review');
  toastAssert.equal(toastHref(toastRow('1')), '/notifications');
});
