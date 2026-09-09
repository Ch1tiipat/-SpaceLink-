import type { NotificationRecord } from '@/lib/api';

export function getSuperAdminNotificationHref(
  notification: NotificationRecord,
): string {
  switch (notification.type) {
    case 'PAYMENT':
    case 'REFUND':
      return '/super-admin/events-bookings?tab=payments';
    case 'BOOKING_STATUS':
      return '/super-admin/events-bookings?tab=bookings';
    case 'SUPPORT_TICKET':
      return '/super-admin/support?tab=tickets';
    case 'PENALTY':
      return '/super-admin/support?tab=moderation';
    case 'ANNOUNCEMENT':
    case 'SYSTEM':
      return '/super-admin/announcements';
  }
}
