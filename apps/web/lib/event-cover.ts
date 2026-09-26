export const EVENT_COVER_FALLBACK = '/event-cover-fallback.svg';

export function getEventCoverUrl(value: string | null | undefined): string {
  if (!value) return EVENT_COVER_FALLBACK;
  try {
    const url = new URL(value);
    if (
      url.protocol !== 'https:' ||
      url.username !== '' ||
      url.password !== ''
    ) {
      return EVENT_COVER_FALLBACK;
    }
    return url.toString();
  } catch {
    return EVENT_COVER_FALLBACK;
  }
}

export function resolveEventCoverUrl(
  value: string | null | undefined,
  hasLoadFailed: boolean,
): string {
  return hasLoadFailed ? EVENT_COVER_FALLBACK : getEventCoverUrl(value);
}
