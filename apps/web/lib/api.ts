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

export type DiscoveryEvent = EventSummary & {
  organization: {
    id: string;
    name: string;
    logoUrl: string | null;
  };
  venue: {
    id: string;
    name: string;
    address: string | null;
  };
  categories: { id: string; name: string }[];
};

export type BoothAvailability = 'AVAILABLE' | 'HELD' | 'BOOKED' | 'UNAVAILABLE';
export type BoothTier = 'S' | 'A' | 'B' | 'C';

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
  tier: BoothTier | null;
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
    organization: {
      id: string;
      name: string;
      contactEmail: string;
      contactPhone: string | null;
      logoUrl: string | null;
    };
    venue: { id: string; name: string; address: string | null };
    policy: {
      generalRules: string | null;
      cancellationPolicy: string | null;
      refundPolicy: string | null;
    } | null;
  };
  zones: EventZone[];
};

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '');

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
  if (!API_BASE_URL) {
    throw new ApiError(
      'ยังไม่ได้ตั้งค่า NEXT_PUBLIC_API_URL สำหรับ SpaceLink Web',
      0,
    );
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      signal,
      headers: { Accept: 'application/json' },
    });
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === 'AbortError') {
      throw cause;
    }

    throw new ApiError(
      'ไม่สามารถเชื่อมต่อ SpaceLink API ได้ กรุณาลองใหม่อีกครั้ง',
      0,
    );
  }

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

export function getEvents(signal?: AbortSignal): Promise<DiscoveryEvent[]> {
  return getJson<DiscoveryEvent[]>('/events/discovery', signal);
}

export function getEventMap(
  eventId: string,
  signal?: AbortSignal,
): Promise<EventMap> {
  return getJson<EventMap>(
    `/events/${encodeURIComponent(eventId)}/map`,
    signal,
  );
}
