export const NOTIFICATION_TOAST_LIFETIME_MS = 60_000;

export interface ToastNotification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  createdAt: string;
  relatedEntityType: string | null;
  relatedEntityId: string | null;
}
export interface ToastBroadcast {
  id: string;
  title: string;
  body: string;
}
export interface NotificationToast {
  id: string;
  title: string;
  body: string;
  href: string;
  label: string;
  expiresAt: number;
  broadcastId?: string;
}

export function notificationToastHref(notification: ToastNotification): string {
  const id = notification.relatedEntityId;
  if (notification.relatedEntityType === 'BOOKING_REVIEW') {
    return id ? `/bookings/${encodeURIComponent(id)}/review` : '/reviews';
  }
  if (notification.type === 'SUPPORT_TICKET') return '/support';
  if (notification.relatedEntityType === 'REFUND_REQUEST') {
    return id ? `/refunds?refundId=${encodeURIComponent(id)}` : '/refunds';
  }
  if (notification.relatedEntityType === 'BOOKING' && id) {
    return `/bookings/${encodeURIComponent(id)}`;
  }
  if (notification.type === 'PAYMENT' || notification.type === 'BOOKING_STATUS') return '/bookings';
  return '/notifications';
}

interface ControllerOptions {
  fetchSnapshot: (accountId: string, signal: AbortSignal) => Promise<{
    notifications: ToastNotification[];
    broadcast: ToastBroadcast | null;
  }>;
  onChange: (toasts: NotificationToast[]) => void;
  now?: () => number;
  setTimeout: (callback: () => void, delay: number) => unknown;
  clearTimeout: (handle: unknown) => void;
  getDismissedBroadcastId?: () => string | null;
}

/** One ephemeral, authenticated account's queue; never persists private content.
 * Push messages carry identity only. Every card comes from the owner's API.
 */
export function createNotificationToastController(options: ControllerOptions) {
  const now = options.now ?? Date.now;
  let accountId: string | null = null;
  let accountStartedAt = now();
  let disposed = false;
  let generation = 0;
  let initialized = false;
  let seen = new Set<string>();
  let seenBroadcasts = new Set<string>();
  let pendingIds = new Set<string>();
  let toasts: NotificationToast[] = [];
  let expiryTimer: unknown;
  let request: AbortController | null = null;
  let refreshAgain = false;

  function publish() {
    if (expiryTimer !== undefined) options.clearTimeout(expiryTimer);
    expiryTimer = undefined;
    toasts = toasts.filter((toast) => toast.expiresAt > now());
    options.onChange([...toasts]);
    if (toasts.length) {
      expiryTimer = options.setTimeout(() => publish(),
        Math.max(0, Math.min(...toasts.map((toast) => toast.expiresAt)) - now()));
    }
  }

  async function refresh() {
    if (disposed || !accountId) return;
    publish(); // Expire promptly on focus after browser timer throttling.
    if (request) { refreshAgain = true; return; }
    const owner = accountId;
    const version = generation;
    const controller = new AbortController();
    request = controller;
    try {
      const snapshot = await options.fetchSnapshot(owner, controller.signal);
      if (disposed || controller.signal.aborted || version !== generation) return;
      const { broadcast } = snapshot;
      if (!broadcast) toasts = toasts.filter((toast) => !toast.broadcastId);
      // Broadcast API and its per-user SYSTEM row represent one card.
      const isBroadcastRow = (row: ToastNotification) => broadcast &&
        row.type === 'SYSTEM' && !row.relatedEntityType &&
        row.title === broadcast.title && row.body === broadcast.body;
      const additions: NotificationToast[] = [];
      for (const row of [...snapshot.notifications].sort((a, b) =>
        Date.parse(a.createdAt) - Date.parse(b.createdAt) || a.id.localeCompare(b.id))) {
        if (seen.has(row.id)) continue;
        seen.add(row.id);
        if (isBroadcastRow(row)) continue;
        if (!initialized && !pendingIds.has(row.id) && Date.parse(row.createdAt) < accountStartedAt) continue;
        additions.push({
          id: row.id, title: row.title, body: row.body ?? '',
          href: notificationToastHref(row),
          label: row.relatedEntityType === 'BOOKING_REVIEW' ? 'เขียนรีวิว' :
            row.type === 'SUPPORT_TICKET' ? 'สถานะคำร้อง' : 'การแจ้งเตือน',
          expiresAt: now() + NOTIFICATION_TOAST_LIFETIME_MS,
        });
      }
      initialized = true;
      pendingIds.clear();
      if (broadcast && !seenBroadcasts.has(broadcast.id)) {
        seenBroadcasts.add(broadcast.id);
        if (options.getDismissedBroadcastId?.() !== broadcast.id) {
          additions.push({ id: `broadcast:${broadcast.id}`, broadcastId: broadcast.id,
            title: broadcast.title, body: broadcast.body, href: '/notifications',
            label: 'ประกาศสำคัญ', expiresAt: now() + NOTIFICATION_TOAST_LIFETIME_MS });
        }
      }
      toasts = [...toasts, ...additions];
      publish();
    } catch {
      if (!disposed && version === generation && !controller.signal.aborted) {
        // Unavailable auth/API must not leave private content on screen.
        toasts = [];
        publish();
      }
    } finally {
      if (request === controller) {
        request = null;
        if (refreshAgain && !disposed) { refreshAgain = false; void refresh(); }
      }
    }
  }

  return {
    refresh,
    push(notificationId?: string) {
      if (notificationId && !seen.has(notificationId)) pendingIds.add(notificationId);
      void refresh();
    },
    setAccount(nextAccountId: string | null) {
      if (disposed || accountId === nextAccountId) return;
      generation += 1;
      request?.abort();
      request = null;
      refreshAgain = false;
      accountId = nextAccountId;
      accountStartedAt = now();
      initialized = false;
      seen = new Set();
      seenBroadcasts = new Set();
      pendingIds = new Set();
      toasts = [];
      publish();
    },
    dismiss(id: string) {
      toasts = toasts.filter((toast) => toast.id !== id);
      publish();
    },
    dispose() {
      disposed = true;
      generation += 1;
      request?.abort();
      request = null;
      toasts = [];
      if (expiryTimer !== undefined) options.clearTimeout(expiryTimer);
      expiryTimer = undefined;
      options.onChange([]);
    },
  };
}
