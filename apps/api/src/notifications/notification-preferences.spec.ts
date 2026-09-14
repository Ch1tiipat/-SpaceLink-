import { NotificationType } from '@prisma/client';
import {
  isNotificationTypeEnabled,
  normalizeNotificationPreferences,
  NOTIFICATION_TYPES,
} from './notification-preferences';

describe('notification preferences', () => {
  it.each([null, undefined, 'invalid', 1, true, []])(
    'treats %p as enabled defaults',
    (preferences) => {
      expect(
        isNotificationTypeEnabled(preferences, NotificationType.BOOKING_STATUS),
      ).toBe(true);
    },
  );

  it('treats a missing key and values other than false as enabled', () => {
    expect(isNotificationTypeEnabled({}, NotificationType.BOOKING_STATUS)).toBe(
      true,
    );
    expect(
      isNotificationTypeEnabled(
        { BOOKING_STATUS: true },
        NotificationType.BOOKING_STATUS,
      ),
    ).toBe(true);
    expect(
      isNotificationTypeEnabled(
        { BOOKING_STATUS: 'false' },
        NotificationType.BOOKING_STATUS,
      ),
    ).toBe(true);
  });

  it('disables only a key whose stored value is exactly false', () => {
    expect(
      isNotificationTypeEnabled({ PAYMENT: false }, NotificationType.PAYMENT),
    ).toBe(false);
  });

  it('normalizes all seven supported types without retaining unknown keys', () => {
    const normalized = normalizeNotificationPreferences({
      PAYMENT: false,
      UNKNOWN: false,
    });

    expect(Object.keys(normalized)).toEqual(NOTIFICATION_TYPES);
    expect(normalized.PAYMENT).toBe(false);
    expect(normalized.BOOKING_STATUS).toBe(true);
  });
});
