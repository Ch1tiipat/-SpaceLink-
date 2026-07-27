export type EventSummary = {
  id: string;
  name: string;
  description: string | null;
  startDate: string;
  endDate: string;
  startTime: string | null;
  endTime: string | null;
  bannerUrl: string | null;
  status: string;
};

export type BoothAvailability = 'AVAILABLE' | 'HELD' | 'BOOKED' | 'UNAVAILABLE';

export type EventBooth = {
  id: string;
  zoneId: string;
  code: string;
  boothPrice: string;
  widthM: string | null;
  heightM: string | null;
  posX: string | null;
  posY: string | null;
  availability: BoothAvailability;
};

export type EventZone = {
  id: string;
  code: string;
  name: string | null;
  description: string | null;
  posX: string | null;
  posY: string | null;
  categories: { id: string; name: string }[];
  booths: EventBooth[];
};

export type EventMap = {
  event: EventSummary & {
    mapImageUrl: string | null;
    contactPhone: string | null;
    contactEmail: string | null;
    venue: { id: string; name: string; address: string | null };
    policy: {
      generalRules: string | null;
      cancellationPolicy: string | null;
      refundPolicy: string | null;
    } | null;
  };
  zones: EventZone[];
};

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, '') ??
  'http://localhost:3000/api';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function getJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    signal,
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    throw new ApiError(
      response.status === 404
        ? 'ไม่พบข้อมูลที่ต้องการ'
        : 'เชื่อมต่อข้อมูล SpaceLink ไม่สำเร็จ',
      response.status,
    );
  }

  return (await response.json()) as T;
}

export function getEvents(signal?: AbortSignal): Promise<EventSummary[]> {
  return getJson<EventSummary[]>('/events', signal);
}

export function getEventMap(
  eventId: string,
  signal?: AbortSignal,
): Promise<EventMap> {
  return getJson<EventMap>(`/events/${encodeURIComponent(eventId)}/map`, signal);
}
