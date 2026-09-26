import type { EventSummary, EventZone } from './api';
import { isEventBookable } from './event-booking-rules.ts';

export type EventDetailZoneSummary = {
  totalBooths: number;
  availableBooths: number;
  startingPrice: number | null;
  categories: string[];
};

export type EventDetailPrimaryAction = {
  kind: 'BOOK' | 'MAP';
  label: 'เลือกบูธ' | 'ดูแผนผัง';
};

export type VenueCoordinates = {
  latitude: number;
  longitude: number;
};

export function summarizeEventZones(
  zones: {
    booths: Pick<EventZone['booths'][number], 'boothPrice' | 'availability'>[];
    categories: Pick<EventZone['categories'][number], 'name'>[];
  }[],
): EventDetailZoneSummary {
  const booths = zones.flatMap((zone) => zone.booths);
  const prices = booths
    .map((booth) => Number(booth.boothPrice))
    .filter((price) => Number.isFinite(price) && price >= 0);

  return {
    totalBooths: booths.length,
    availableBooths: booths.filter(
      (booth) => booth.availability === 'AVAILABLE',
    ).length,
    startingPrice: prices.length > 0 ? Math.min(...prices) : null,
    categories: [
      ...new Set(
        zones.flatMap((zone) =>
          zone.categories
            .map((category) => category.name.trim())
            .filter(Boolean),
        ),
      ),
    ],
  };
}

export function getEventDetailPrimaryAction(
  event: Pick<EventSummary, 'status' | 'endDate'>,
  now = new Date(),
): EventDetailPrimaryAction {
  return isEventBookable(event, now)
    ? { kind: 'BOOK', label: 'เลือกบูธ' }
    : { kind: 'MAP', label: 'ดูแผนผัง' };
}

export function getEventBookingStatusLabel(
  event: Pick<EventSummary, 'status' | 'endDate'>,
  now = new Date(),
): string {
  if (isEventBookable(event, now)) return 'กำลังเปิดให้สำรองพื้นที่';
  if (event.status === 'DRAFT') return 'ยังไม่เปิดรับจอง';
  if (event.status === 'COMPLETED') return 'สิ้นสุดแล้ว';
  if (event.status === 'CANCELLED') return 'ยกเลิก Event แล้ว';
  return 'ปิดรับจอง';
}

export function safePublicHttpUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (
      (url.protocol !== 'http:' && url.protocol !== 'https:') ||
      url.username !== '' ||
      url.password !== ''
    ) {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
}

export function safePublicHttpsUrl(value: string | null): string | null {
  const url = safePublicHttpUrl(value);
  return url?.startsWith('https:') ? url : null;
}

export function parseVenueCoordinates(
  latitude: string | null,
  longitude: string | null,
): VenueCoordinates | null {
  if (latitude === null || longitude === null) return null;
  const parsed = { latitude: Number(latitude), longitude: Number(longitude) };
  if (
    !Number.isFinite(parsed.latitude) ||
    !Number.isFinite(parsed.longitude) ||
    parsed.latitude < -90 ||
    parsed.latitude > 90 ||
    parsed.longitude < -180 ||
    parsed.longitude > 180
  ) {
    return null;
  }
  return parsed;
}

export function googleMapsEmbedUrl({
  latitude,
  longitude,
}: VenueCoordinates): string {
  const destination = encodeURIComponent(`${latitude},${longitude}`);
  return `https://www.google.com/maps?q=${destination}&z=16&output=embed`;
}

export function googleMapsDirectionsUrl({
  latitude,
  longitude,
}: VenueCoordinates): string {
  const destination = encodeURIComponent(`${latitude},${longitude}`);
  return `https://www.google.com/maps/dir/?api=1&destination=${destination}`;
}
