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

export type VendorShop = {
  id: string;
  name: string;
  description: string | null;
  logoUrl: string | null;
  categories: { id: string; name: string }[];
};

export type ZoneRecommendation = {
  boothId: string;
  score: number;
  reason: string;
  source: 'AI_GEMINI' | 'RULE_BASED';
};

export type ZoneRecommendationInput = {
  shopId: string;
  productCategoryIds?: string[];
  limit?: number;
};

/** The `app_user.role` values (AGENTS.md §5). Platform-level, not org-level. */
export type UserRole = 'SUPER_ADMIN' | 'ORG_ADMIN' | 'VENDOR';

/**
 * Exactly what `GET /auth/me` returns — no more. `blacklistReason` and penalty
 * details are admin-facing and the endpoint deliberately withholds them
 * (AGENTS.md §14.5), so there is nothing here to widen this type with.
 */
export type CurrentUser = {
  id: string;
  authUserId: string;
  email: string;
  fullName: string;
  phone: string | null;
  role: UserRole;
  isBlacklisted: boolean;
  createdAt: string;
  updatedAt: string;
  shops: VendorShop[];
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

type RequestOptions = {
  signal?: AbortSignal;
  /**
   * A Supabase access token. Present only for routes behind SupabaseAuthGuard;
   * public reads (events, venues, zones, booths) send no Authorization header.
   */
  token?: string;
};

async function getJson<T>(
  path: string,
  { signal, token }: RequestOptions = {},
): Promise<T> {
  if (!API_BASE_URL) {
    throw new ApiError(
      'ยังไม่ได้ตั้งค่า NEXT_PUBLIC_API_URL สำหรับ SpaceLink Web',
      0,
    );
  }

  const headers: Record<string, string> = { Accept: 'application/json' };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      signal,
      headers,
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

async function postJson<T>(
  path: string,
  body: unknown,
  { signal, token }: RequestOptions = {},
): Promise<T> {
  if (!API_BASE_URL) {
    throw new ApiError(
      'ยังไม่ได้ตั้งค่า NEXT_PUBLIC_API_URL สำหรับ SpaceLink Web',
      0,
    );
  }

  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method: 'POST',
      signal,
      headers,
      body: JSON.stringify(body),
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
    const payload = (await response.json().catch(() => null)) as {
      message?: string | string[];
    } | null;
    const detail = Array.isArray(payload?.message)
      ? payload.message.join(', ')
      : payload?.message;

    throw new ApiError(
      detail || 'ระบบแนะนำโซนไม่สามารถทำงานได้ในขณะนี้',
      response.status,
    );
  }

  return (await response.json()) as T;
}

export function getEvents(signal?: AbortSignal): Promise<DiscoveryEvent[]> {
  return getJson<DiscoveryEvent[]>('/events/discovery', { signal });
}

export function getEventMap(
  eventId: string,
  signal?: AbortSignal,
): Promise<EventMap> {
  return getJson<EventMap>(`/events/${encodeURIComponent(eventId)}/map`, {
    signal,
  });
}

/**
 * The only auth endpoint (AGENTS.md §7) — there is no login or register route
 * on our API; the browser gets its token from Supabase Auth and this exchanges
 * it for the `app_user` row, provisioning that row on first sight.
 *
 * The path is `/auth/me`, not `/api/auth/me`: NEXT_PUBLIC_API_URL already ends
 * in the global prefix that main.ts sets.
 */
export function getMe(
  token: string,
  signal?: AbortSignal,
): Promise<CurrentUser> {
  return getJson<CurrentUser>('/auth/me', { signal, token });
}

export function getZoneRecommendations(
  eventId: string,
  input: ZoneRecommendationInput,
  token: string,
  signal?: AbortSignal,
): Promise<ZoneRecommendation[]> {
  return postJson<ZoneRecommendation[]>(
    `/events/${encodeURIComponent(eventId)}/recommendations`,
    input,
    { signal, token },
  );
}
