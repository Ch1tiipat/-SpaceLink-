import type { DiscoveryEvent } from './api';

export function resolveSavedEvents(
  events: DiscoveryEvent[],
  savedEventIds: string[],
): DiscoveryEvent[] {
  const eventsById = new Map(events.map((event) => [event.id, event]));
  const seen = new Set<string>();

  return savedEventIds.flatMap((eventId) => {
    if (seen.has(eventId)) return [];
    seen.add(eventId);
    const event = eventsById.get(eventId);
    return event ? [event] : [];
  });
}

export function withoutSavedEvent(
  savedEventIds: string[],
  eventId: string,
): string[] {
  return savedEventIds.filter((savedEventId) => savedEventId !== eventId);
}
