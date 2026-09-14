import { NotificationType, Prisma } from '@prisma/client';

export const NOTIFICATION_TYPES = [
  NotificationType.BOOKING_STATUS,
  NotificationType.PAYMENT,
  NotificationType.ANNOUNCEMENT,
  NotificationType.PENALTY,
  NotificationType.REFUND,
  NotificationType.SUPPORT_TICKET,
  NotificationType.SYSTEM,
] as const;

export type NotificationPreferences = Record<NotificationType, boolean>;

export function isNotificationTypeEnabled(
  preferences: Prisma.JsonValue | null | undefined,
  type: NotificationType,
): boolean {
  if (
    !preferences ||
    typeof preferences !== 'object' ||
    Array.isArray(preferences)
  ) {
    return true;
  }

  return (preferences as Record<string, unknown>)[type] !== false;
}

export function normalizeNotificationPreferences(
  preferences: Prisma.JsonValue | null | undefined,
): NotificationPreferences {
  return Object.fromEntries(
    NOTIFICATION_TYPES.map((type) => [
      type,
      isNotificationTypeEnabled(preferences, type),
    ]),
  ) as NotificationPreferences;
}
