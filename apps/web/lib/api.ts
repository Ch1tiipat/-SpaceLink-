export type EventSummary = {
  id: string;
  name: string;
  description: string | null;
  startDate: string;
  endDate: string;
  startTime: string | null;
  endTime: string | null;
  bannerUrl: string | null;
  status: "DRAFT" | "PUBLISHED" | "ONGOING" | "COMPLETED" | "CANCELLED";
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

export type BoothAvailability = "AVAILABLE" | "HELD" | "BOOKED" | "UNAVAILABLE";
export type BoothTier = "S" | "A" | "B" | "C";

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
  /** Public shop identity is present only after the booking is confirmed. */
  occupant: {
    id: string;
    name: string;
    logoUrl: string | null;
  } | null;
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

/**
 * `logoUrl` is accepted by CreateShopDto but deliberately absent here: a logo
 * is set by `uploadShopLogo`, which sends the file itself, so nothing in the
 * profile form ever puts a URL in this body.
 */
export type CreateShopInput = {
  name: string;
  description?: string;
  categoryIds: string[];
};

/**
 * Every field optional, mirroring UpdateShopDto. An omitted key means "leave it
 * alone"; the backend rejects an explicit `null` with 400, so never send one —
 * `JSON.stringify` already drops `undefined` values from the body.
 */
export type UpdateShopInput = Partial<CreateShopInput>;

export type ProductCategory = {
  id: string;
  name: string;
};

export type UpdateMeInput = {
  phone?: string;
};

/** What PATCH /users/me returns — CurrentUser without the `shops` field. */
export type UserProfile = Omit<CurrentUser, "shops" | "organizations">;

export type ZoneRecommendation = {
  boothId: string;
  score: number;
  reason: string;
  source: "AI_GEMINI" | "RULE_BASED";
};

export type ZoneRecommendationInput = {
  shopId: string;
  productCategoryIds?: string[];
  preferredZoneId?: string;
  requiredFacilities?: string[];
  limit?: number;
};

export type SupportAssistantResponse = {
  answer: string;
  source: "AI_GEMINI" | "RULE_BASED";
  actions: SupportAssistantAction[];
};

export type SupportAssistantAction =
  "OPEN_EVENTS" | "OPEN_BOOKINGS" | "OPEN_PROFILE";

export type SupportAssistantHistoryMessage = {
  role: "user" | "assistant";
  text: string;
};

export type BookingStatus =
  "PENDING_PAYMENT" | "CONFIRMED" | "CANCELLED" | "NO_SHOW" | "COMPLETED";

export type BookingRecord = {
  id: string;
  bookingCode: string;
  eventId: string;
  boothId: string;
  shopId: string;
  vendorUserId: string;
  bookingStartDate: string;
  bookingEndDate: string;
  boothPrice: string;
  isPaymentExempt: boolean;
  paymentExemptReason: string | null;
  status: BookingStatus;
  holdExpiresAt: string | null;
  confirmedAt: string | null;
  cancelReason: string | null;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
  /** Present after hydrating the booking through GET /bookings. */
  paymentQrDataUri?: string | null;
};

export type MyBooking = BookingRecord & {
  paymentQrDataUri: string | null;
  event: { id: string; name: string };
  booth: {
    id: string;
    code: string;
    zone: { id: string; code: string; name: string | null };
  };
  shop: { id: string; name: string };
};

export type CreateBookingInput = {
  eventId: string;
  boothId: string;
  shopId: string;
};

export type ReviewTargetType = "BOOTH" | "ZONE" | "SHOP" | "ORGANIZATION";

export type AverageRating = {
  average: number | null;
  count: number;
};

export type CreateReviewInput = {
  targetType: "BOOTH" | "ZONE";
  targetId: string;
  rating: number;
  comment?: string;
  reviewerDisplayName?: string;
};

export type PenaltyReason =
  "NO_SHOW" | "RULE_VIOLATION" | "CONTRACT_BREACH" | "BAD_REVIEW" | "OTHER";

export type PenaltyRecord = {
  id: string;
  organizationId: string;
  userId: string;
  bookingId: string | null;
  reason: PenaltyReason;
  description: string | null;
  points: number;
  issuedAt: string;
  createdAt: string;
};

export type PenaltyHistory = {
  penalties: PenaltyRecord[];
  totalPointsAllOrgs: number;
};

export type CreatePenaltyInput = {
  reason: PenaltyReason;
  description?: string;
};

export type CreatePenaltyResult = {
  penalty: PenaltyRecord;
  justBlacklisted: boolean;
  totalPoints: number;
};

export type SupportTicketStatus = "OPEN" | "PROCESSING" | "CLOSED";

export type SupportTicketRecord = {
  id: string;
  userId: string;
  organizationId: string | null;
  bookingId: string | null;
  type: string;
  subject: string;
  status: SupportTicketStatus;
  createdAt: string;
  updatedAt: string;
};

export type CreateSupportTicketInput = {
  eventId: string;
  subject: string;
  message: string;
};

export type ApproveQuotaExceptionInput = {
  eventId: string;
  boothId: string;
};

export type SlipVerificationStatus =
  "VERIFIED" | "INVALID" | "DUPLICATE" | "ERROR";

export type SlipUploadResponse = {
  booking: {
    id: string;
    status: BookingStatus;
    confirmedAt: string | null;
    holdExpiresAt: string;
  };
  verification: {
    status: SlipVerificationStatus;
    message: string;
  };
};

/** The `app_user.role` values (AGENTS.md §5). Platform-level, not org-level. */
export type UserRole = "SUPER_ADMIN" | "ORG_ADMIN" | "VENDOR";

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
  organizations: {
    id: string;
    name: string;
    promptpayId: string | null;
    membershipRole: "OWNER" | "ADMIN";
  }[];
};

export type OrganizationSettings = {
  id: string;
  name: string;
  description: string | null;
  contactEmail: string;
  contactPhone: string | null;
  logoUrl: string | null;
  status: string;
  promptpayId: string | null;
};

export type SuperAdminOrganizationStatus = "ACTIVE" | "INACTIVE" | "SUSPENDED";

export type SuperAdminOrganization = {
  id: string;
  name: string;
  description: string | null;
  contactEmail: string;
  contactPhone: string | null;
  logoUrl: string | null;
  status: SuperAdminOrganizationStatus;
};

export type CreateSuperAdminOrganizationInput = {
  name: string;
  contactEmail: string;
  contactPhone?: string;
  promptpayId?: string;
};

export type SuperAdminCompanyAdmin = {
  id: string;
  joinedAt: string;
  user: { id: string; email: string; fullName: string };
  organization: { id: string; name: string };
};

export type SuperAdminUserListItem = {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  isBlacklisted: boolean;
};

export type SuperAdminUserDetail = SuperAdminUserListItem & {
  phone: string | null;
  blacklistReason: string | null;
  createdAt: string;
  updatedAt: string;
  shops: {
    id: string;
    name: string;
    description: string | null;
    logoUrl: string | null;
    createdAt: string;
  }[];
  bookings: {
    id: string;
    bookingCode: string;
    status: BookingStatus;
    boothPrice: string;
    bookingStartDate: string;
    bookingEndDate: string;
    createdAt: string;
    event: { id: string; name: string };
    shop: { id: string; name: string };
  }[];
  refunds: {
    id: string;
    reason: string;
    requestedAmount: string;
    approvedAmount: string | null;
    status: "PENDING" | "APPROVED" | "REJECTED" | "PROCESSED";
    createdAt: string;
    booking: { id: string; bookingCode: string };
  }[];
  penalties: {
    id: string;
    reason: PenaltyReason;
    description: string | null;
    points: number;
    issuedAt: string;
    organization: { id: string; name: string };
  }[];
  supportTickets: {
    id: string;
    type: string;
    subject: string;
    status: SupportTicketStatus;
    createdAt: string;
  }[];
};

export type SuperAdminUserLastLogin = {
  lastSignInAt: string | null;
};

export type SuperAdminBooking = BookingRecord & {
  event: {
    id: string;
    name: string;
    organizationId: string;
    organization: { id: string; name: string };
  };
  shop: { id: string; name: string };
  vendor: { id: string; email: string; fullName: string };
  booth: {
    id: string;
    code: string;
    zone: { id: string; code: string; name: string | null };
  };
};

/** Organization-scoped event row returned to ORG_ADMIN/SUPER_ADMIN. */
export type AdminOrganizationEvent = EventSummary & {
  organizationId: string;
  venueId: string;
  mapImageUrl: string | null;
  venue: { id: string; name: string };
  subscription: EventSubscription | null;
};

export type EventSubscriptionQuote = {
  baseFee: string;
  zoneCount: number;
  perZoneRate: string;
  eventDays: number;
  perDayRate: string;
  calculatedPrice: string;
  priceMin: string;
  priceMax: string;
  finalPrice: string;
  isOverMax: boolean;
};

export type EventSubscription = EventSubscriptionQuote & {
  id: string;
  organizationId: string;
  eventId: string;
  status: "DRAFT" | "PENDING_PAYMENT" | "ACTIVE" | "EXPIRED" | "CANCELLED";
  platformPaidAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateAdminEventInput = {
  venueId: string;
  name: string;
  description?: string;
  startDate: string;
  endDate: string;
  startTime?: string;
  endTime?: string;
  contactPhone?: string;
  contactEmail?: string;
  expectedFinalPrice?: string;
};

export type PlatformBillingConfig = {
  id: string | null;
  baseFee: string;
  perZoneRate: string;
  perDayRate: string;
  priceMin: string;
  priceMax: string;
  updatedAt: string | null;
};

export type UpdatePlatformBillingConfigInput = Omit<
  PlatformBillingConfig,
  "id" | "updatedAt"
>;

/** The organization booking endpoint intentionally returns the same safe
 * admin projection as the platform overview, already filtered by membership. */
export type AdminOrganizationBooking = SuperAdminBooking;

export type AdminOrganizationRefund = {
  id: string;
  bookingId: string;
  requestedByUserId: string;
  reason: string;
  requestedAmount: string;
  approvedAmount: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED" | "PROCESSED";
  evidenceUrls: string[];
  reviewedByUserId: string | null;
  reviewedAt: string | null;
  processedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SuperAdminRefund = {
  id: string;
  bookingId: string;
  requestedByUserId: string;
  reason: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "PROCESSED";
  requestedAmount: string;
  approvedAmount: string | null;
  evidenceUrls: string[];
  reviewedByUserId: string | null;
  reviewedAt: string | null;
  processedAt: string | null;
  createdAt: string;
  updatedAt: string;
  booking: {
    id: string;
    bookingCode: string;
    event: {
      id: string;
      name: string;
      organization: { id: string; name: string };
    };
    shop: { id: string; name: string };
  };
  requestedBy: { id: string; email: string; fullName: string };
};

export type SuperAdminSupportTicket = {
  id: string;
  type: string;
  subject: string;
  status: SupportTicketStatus;
  createdAt: string;
  updatedAt: string;
  user: { id: string; email: string; fullName: string };
  organization: { id: string; name: string } | null;
};

export type SuperAdminPenaltiesOverview = {
  penalties: {
    id: string;
    reason: PenaltyReason;
    description: string | null;
    points: number;
    issuedAt: string;
    user: { id: string; email: string; fullName: string };
    organization: { id: string; name: string };
  }[];
  blacklistedUsers: {
    id: string;
    email: string;
    fullName: string;
    blacklistReason: string | null;
  }[];
};

export type SuperAdminAuditAction =
  | "ORGANIZATION_CREATED"
  | "ORGANIZATION_STATUS_UPDATED"
  | "ORG_ADMIN_GRANTED"
  | "ORG_ADMIN_REVOKED"
  | "PLATFORM_CONFIG_UPDATED";

export type SuperAdminAuditTargetType =
  | "ORGANIZATION"
  | "USER"
  | "PLATFORM_CONFIG";

export type SuperAdminAuditLogFilter = {
  action?: SuperAdminAuditAction;
  actorUserId?: string;
};

export type SuperAdminAuditLog = {
  id: string;
  action: SuperAdminAuditAction;
  targetType: SuperAdminAuditTargetType;
  targetId: string;
  metadata: unknown;
  createdAt: string;
  actor: { id: string; email: string; fullName: string };
};

export type AdminDashboardSummary = {
  organizationId: string;
  bookings: {
    pendingPayment: number;
    confirmed: number;
    cancelled: number;
  };
  resources: {
    venues: number;
    zones: number;
    booths: number;
  };
  events: {
    published: number;
    upcoming: number;
  };
};

export type AdminVenue = {
  id: string;
  organizationId: string;
  name: string;
  description: string | null;
  address: string | null;
  latitude: string | null;
  longitude: string | null;
  mapImageUrl: string | null;
  status: "ACTIVE" | "INACTIVE";
  createdAt: string;
  updatedAt: string;
};

export type AdminZone = {
  id: string;
  venueId: string;
  code: string;
  name: string | null;
  description: string | null;
  defaultBoothPrice: string | null;
  posX: string | null;
  posY: string | null;
  imageUrls: unknown;
  createdAt: string;
  updatedAt: string;
};

export type AdminBoothStatus =
  "AVAILABLE" | "BOOKED" | "MAINTENANCE" | "INACTIVE";

export type AdminBooth = {
  id: string;
  zoneId: string;
  code: string;
  boothPrice: string;
  widthM: string | null;
  heightM: string | null;
  facilities: unknown;
  posX: string | null;
  posY: string | null;
  status: AdminBoothStatus;
  createdAt: string;
  updatedAt: string;
};

export type SaveZoneInput = {
  code: string;
  name?: string;
  description?: string;
  defaultBoothPrice?: string;
  posX?: number;
  posY?: number;
};

export type SaveBoothInput = {
  code: string;
  boothPrice: string;
  widthM?: number;
  heightM?: number;
  posX?: number;
  posY?: number;
};

export type UpdateBoothInput = Partial<SaveBoothInput> & {
  status?: AdminBoothStatus;
};

export type AdminAnnouncement = {
  id: string;
  organizationId: string;
  title: string;
  body: string;
  isActive: boolean;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SuperAdminAnnouncement = AdminAnnouncement & {
  organization: { id: string; name: string };
};

export type SaveAnnouncementInput = {
  title: string;
  body: string;
  isActive?: boolean;
  publishedAt?: string;
};

export type NotificationType =
  | "ANNOUNCEMENT"
  | "BOOKING_STATUS"
  | "PAYMENT"
  | "REFUND"
  | "SUPPORT_TICKET"
  | "PENALTY"
  | "SYSTEM";

export type NotificationRecord = {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string | null;
  relatedEntityType: string | null;
  relatedEntityId: string | null;
  isRead: boolean;
  createdAt: string;
};

export type NotificationCount = { count: number };

export type PushSubscriptionInput = {
  endpoint: string;
  expirationTime?: number | null;
  keys: { p256dh: string; auth: string };
};

export type PushSubscriptionRecord = {
  id: string;
  endpoint: string;
  createdAt: string;
  lastUsedAt: string | null;
};

export type SystemBroadcast = {
  id: string;
  title: string;
  body: string;
  createdBy: string;
  expiresAt: string | null;
  createdAt: string;
};

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "");

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
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
      "ยังไม่ได้ตั้งค่า NEXT_PUBLIC_API_URL สำหรับ SpaceLink Web",
      0,
    );
  }

  const headers: Record<string, string> = { Accept: "application/json" };
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
    if (cause instanceof DOMException && cause.name === "AbortError") {
      throw cause;
    }

    throw new ApiError(
      "ไม่สามารถเชื่อมต่อ SpaceLink API ได้ กรุณาลองใหม่อีกครั้ง",
      0,
    );
  }

  if (!response.ok) {
    throw new ApiError(
      response.status === 404
        ? "ไม่พบข้อมูลที่ต้องการ"
        : "เชื่อมต่อข้อมูล SpaceLink ไม่สำเร็จ",
      response.status,
    );
  }

  return (await response.json()) as T;
}

async function sendJson<T>(
  method: "POST" | "PATCH",
  path: string,
  body: unknown,
  { signal, token }: RequestOptions = {},
  fallbackMessage = "ดำเนินการไม่สำเร็จ กรุณาลองใหม่อีกครั้ง",
): Promise<T> {
  if (!API_BASE_URL) {
    throw new ApiError(
      "ยังไม่ได้ตั้งค่า NEXT_PUBLIC_API_URL สำหรับ SpaceLink Web",
      0,
    );
  }

  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      signal,
      headers,
      body: JSON.stringify(body),
    });
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === "AbortError") {
      throw cause;
    }

    throw new ApiError(
      "ไม่สามารถเชื่อมต่อ SpaceLink API ได้ กรุณาลองใหม่อีกครั้ง",
      0,
    );
  }

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as {
      message?: string | string[];
    } | null;
    const detail = Array.isArray(payload?.message)
      ? payload.message.join(", ")
      : payload?.message;

    throw new ApiError(detail || fallbackMessage, response.status);
  }

  return (await response.json()) as T;
}

function postJson<T>(
  path: string,
  body: unknown,
  options: RequestOptions = {},
  fallbackMessage?: string,
): Promise<T> {
  return sendJson<T>("POST", path, body, options, fallbackMessage);
}

function patchJson<T>(
  path: string,
  body: unknown,
  options: RequestOptions = {},
  fallbackMessage?: string,
): Promise<T> {
  return sendJson<T>("PATCH", path, body, options, fallbackMessage);
}

async function deleteJson<T>(
  path: string,
  { signal, token }: RequestOptions = {},
  fallbackMessage = "ไม่สามารถลบรายการได้ กรุณาลองอีกครั้ง",
): Promise<T> {
  if (!API_BASE_URL) {
    throw new ApiError(
      "ยังไม่ได้ตั้งค่า NEXT_PUBLIC_API_URL สำหรับ SpaceLink Web",
      0,
    );
  }

  const headers: Record<string, string> = { Accept: "application/json" };
  if (token) headers.Authorization = "Bearer " + token;

  let response: Response;
  try {
    response = await fetch(API_BASE_URL + path, {
      method: "DELETE",
      signal,
      headers,
    });
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === "AbortError")
      throw cause;
    throw new ApiError(
      "ไม่สามารถเชื่อมต่อ SpaceLink API ได้ กรุณาลองอีกครั้ง",
      0,
    );
  }

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as {
      message?: string | string[];
    } | null;
    const detail = Array.isArray(payload?.message)
      ? payload.message.join(", ")
      : payload?.message;
    throw new ApiError(detail || fallbackMessage, response.status);
  }

  return (await response.json()) as T;
}

async function deleteJsonWithBody<T>(
  path: string,
  body: unknown,
  { signal, token }: RequestOptions = {},
  fallbackMessage = "ไม่สามารถลบรายการได้ กรุณาลองอีกครั้ง",
): Promise<T> {
  if (!API_BASE_URL) {
    throw new ApiError(
      "ยังไม่ได้ตั้งค่า NEXT_PUBLIC_API_URL สำหรับ SpaceLink Web",
      0,
    );
  }

  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
  };
  if (token) headers.Authorization = "Bearer " + token;

  let response: Response;
  try {
    response = await fetch(API_BASE_URL + path, {
      method: "DELETE",
      signal,
      headers,
      body: JSON.stringify(body),
    });
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === "AbortError") {
      throw cause;
    }
    throw new ApiError(
      "ไม่สามารถเชื่อมต่อ SpaceLink API ได้ กรุณาลองอีกครั้ง",
      0,
    );
  }

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as {
      message?: string | string[];
    } | null;
    const detail = Array.isArray(payload?.message)
      ? payload.message.join(", ")
      : payload?.message;
    throw new ApiError(detail || fallbackMessage, response.status);
  }

  return (await response.json()) as T;
}

/**
 * Admin reads use the existing public discovery endpoints. Mutations never
 * carry organizationId: the API derives it from the selected resource and the
 * authenticated OrgMembership (AGENTS.md §14.2).
 */
export function getAdminVenues(
  token: string,
  signal?: AbortSignal,
): Promise<AdminVenue[]> {
  return getJson<AdminVenue[]>("/venues", { signal, token });
}

export function getAdminZones(
  venueId: string,
  token: string,
  signal?: AbortSignal,
): Promise<AdminZone[]> {
  return getJson<AdminZone[]>("/zones?venueId=" + encodeURIComponent(venueId), {
    signal,
    token,
  });
}

export function createAdminZone(
  venueId: string,
  input: SaveZoneInput,
  token: string,
): Promise<AdminZone> {
  return postJson<AdminZone>(
    "/venues/" + encodeURIComponent(venueId) + "/zones",
    input,
    { token },
    "ไม่สามารถสร้างโซนได้",
  );
}

export function updateAdminZone(
  zoneId: string,
  input: Partial<SaveZoneInput>,
  token: string,
): Promise<AdminZone> {
  return patchJson<AdminZone>(
    "/zones/" + encodeURIComponent(zoneId),
    input,
    { token },
    "ไม่สามารถแก้ไขโซนได้",
  );
}

export function deleteAdminZone(
  zoneId: string,
  token: string,
): Promise<AdminZone> {
  return deleteJson<AdminZone>(
    "/zones/" + encodeURIComponent(zoneId),
    { token },
    "ไม่สามารถลบโซนได้",
  );
}

export function getAdminBooths(
  zoneId: string,
  token: string,
  signal?: AbortSignal,
): Promise<AdminBooth[]> {
  return getJson<AdminBooth[]>("/booths?zoneId=" + encodeURIComponent(zoneId), {
    signal,
    token,
  });
}

export function createAdminBooth(
  zoneId: string,
  input: SaveBoothInput,
  token: string,
): Promise<AdminBooth> {
  return postJson<AdminBooth>(
    "/zones/" + encodeURIComponent(zoneId) + "/booths",
    input,
    { token },
    "ไม่สามารถสร้างบูธได้",
  );
}

export function updateAdminBooth(
  boothId: string,
  input: UpdateBoothInput,
  token: string,
): Promise<AdminBooth> {
  return patchJson<AdminBooth>(
    "/booths/" + encodeURIComponent(boothId),
    input,
    { token },
    "ไม่สามารถแก้ไขบูธได้",
  );
}

export function deleteAdminBooth(
  boothId: string,
  token: string,
): Promise<AdminBooth> {
  return deleteJson<AdminBooth>(
    "/booths/" + encodeURIComponent(boothId),
    { token },
    "ไม่สามารถลบบูธได้",
  );
}

export function getPublicAnnouncements(
  organizationId: string,
  signal?: AbortSignal,
): Promise<AdminAnnouncement[]> {
  return getJson<AdminAnnouncement[]>(
    "/organizations/" + encodeURIComponent(organizationId) + "/announcements",
    { signal },
  );
}

export function getAdminAnnouncements(
  organizationId: string,
  token: string,
  signal?: AbortSignal,
): Promise<AdminAnnouncement[]> {
  return getJson<AdminAnnouncement[]>(
    "/organizations/" +
      encodeURIComponent(organizationId) +
      "/announcements/admin",
    { signal, token },
  );
}

export function createAdminAnnouncement(
  organizationId: string,
  input: SaveAnnouncementInput,
  token: string,
): Promise<AdminAnnouncement> {
  return postJson<AdminAnnouncement>(
    "/organizations/" + encodeURIComponent(organizationId) + "/announcements",
    input,
    { token },
    "ไม่สามารถสร้างประกาศได้",
  );
}

export function updateAdminAnnouncement(
  organizationId: string,
  announcementId: string,
  input: Partial<SaveAnnouncementInput>,
  token: string,
): Promise<AdminAnnouncement> {
  return patchJson<AdminAnnouncement>(
    "/organizations/" +
      encodeURIComponent(organizationId) +
      "/announcements/" +
      encodeURIComponent(announcementId),
    input,
    { token },
    "ไม่สามารถแก้ไขประกาศได้",
  );
}

export function deleteAdminAnnouncement(
  organizationId: string,
  announcementId: string,
  token: string,
): Promise<AdminAnnouncement> {
  return deleteJson<AdminAnnouncement>(
    "/organizations/" +
      encodeURIComponent(organizationId) +
      "/announcements/" +
      encodeURIComponent(announcementId),
    { token },
    "ไม่สามารถลบประกาศได้",
  );
}

export function getMyNotifications(
  token: string,
  signal?: AbortSignal,
): Promise<NotificationRecord[]> {
  return getJson<NotificationRecord[]>("/notifications", { signal, token });
}

export function getUnreadNotificationCount(
  token: string,
  signal?: AbortSignal,
): Promise<NotificationCount> {
  return getJson<NotificationCount>("/notifications/unread-count", {
    signal,
    token,
  });
}

export function markNotificationRead(
  notificationId: string,
  token: string,
): Promise<NotificationCount> {
  return patchJson<NotificationCount>(
    `/notifications/${encodeURIComponent(notificationId)}/read`,
    {},
    { token },
    "ไม่สามารถอัปเดตการแจ้งเตือนได้",
  );
}

export function markAllNotificationsRead(
  token: string,
): Promise<NotificationCount> {
  return patchJson<NotificationCount>(
    "/notifications/mark-all-read",
    {},
    { token },
    "ไม่สามารถอัปเดตการแจ้งเตือนทั้งหมดได้",
  );
}

export function createPushSubscription(
  input: PushSubscriptionInput,
  token: string,
): Promise<PushSubscriptionRecord> {
  return postJson<PushSubscriptionRecord>(
    "/push-subscriptions",
    input,
    { token },
    "เปิดการแจ้งเตือนบนอุปกรณ์นี้ไม่สำเร็จ",
  );
}

export function deletePushSubscription(
  endpoint: string,
  token: string,
): Promise<NotificationCount> {
  return deleteJsonWithBody<NotificationCount>(
    "/push-subscriptions",
    { endpoint },
    { token },
    "ปิดการแจ้งเตือนบนอุปกรณ์นี้ไม่สำเร็จ",
  );
}

export function getActiveSystemBroadcast(
  token: string,
  signal?: AbortSignal,
): Promise<SystemBroadcast | null> {
  return getJson<SystemBroadcast | null>("/system-broadcasts/active", {
    signal,
    token,
  });
}

export function createSystemBroadcast(
  input: { title: string; body: string },
  token: string,
): Promise<SystemBroadcast> {
  return postJson<SystemBroadcast>(
    "/system-broadcasts",
    input,
    { token },
    "ส่งประกาศระบบไม่สำเร็จ",
  );
}

export function getEvents(signal?: AbortSignal): Promise<DiscoveryEvent[]> {
  return getJson<DiscoveryEvent[]>("/events/discovery", { signal });
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
  return getJson<CurrentUser>("/auth/me", { signal, token });
}

export function getAdminDashboardSummary(
  organizationId: string,
  token: string,
  signal?: AbortSignal,
): Promise<AdminDashboardSummary> {
  return getJson<AdminDashboardSummary>(
    `/organizations/${encodeURIComponent(organizationId)}/dashboard-summary`,
    { signal, token },
  );
}

export function getAdminOrganizationEvents(
  organizationId: string,
  token: string,
  signal?: AbortSignal,
): Promise<AdminOrganizationEvent[]> {
  return getJson<AdminOrganizationEvent[]>(
    `/organizations/${encodeURIComponent(organizationId)}/events`,
    { signal, token },
  );
}

export function quoteAdminEventSubscription(
  organizationId: string,
  input: CreateAdminEventInput,
  token: string,
): Promise<EventSubscriptionQuote> {
  return postJson<EventSubscriptionQuote>(
    `/organizations/${encodeURIComponent(organizationId)}/events/quote`,
    input,
    { token },
    "คำนวณค่าบริการอีเวนต์ไม่สำเร็จ",
  );
}

export function createAdminEvent(
  organizationId: string,
  input: CreateAdminEventInput,
  token: string,
): Promise<AdminOrganizationEvent> {
  return postJson<AdminOrganizationEvent>(
    `/organizations/${encodeURIComponent(organizationId)}/events`,
    input,
    { token },
    "สร้างอีเวนต์ไม่สำเร็จ",
  );
}

export function publishAdminEvent(
  organizationId: string,
  eventId: string,
  token: string,
): Promise<AdminOrganizationEvent> {
  return patchJson<AdminOrganizationEvent>(
    `/organizations/${encodeURIComponent(organizationId)}/events/${encodeURIComponent(eventId)}/publish`,
    {},
    { token },
    "เผยแพร่อีเวนต์ไม่สำเร็จ",
  );
}

export function getAdminOrganizationBookings(
  organizationId: string,
  token: string,
  signal?: AbortSignal,
): Promise<AdminOrganizationBooking[]> {
  return getJson<AdminOrganizationBooking[]>(
    `/organizations/${encodeURIComponent(organizationId)}/bookings`,
    { signal, token },
  );
}

export function getAdminOrganizationRefunds(
  organizationId: string,
  token: string,
  signal?: AbortSignal,
): Promise<AdminOrganizationRefund[]> {
  return getJson<AdminOrganizationRefund[]>(
    `/organizations/${encodeURIComponent(organizationId)}/refunds`,
    { signal, token },
  );
}

export function getSuperAdminOrganizations(
  token: string,
  signal?: AbortSignal,
): Promise<SuperAdminOrganization[]> {
  return getJson<SuperAdminOrganization[]>("/organizations", {
    signal,
    token,
  });
}

export function getPlatformBillingConfig(
  token: string,
  signal?: AbortSignal,
): Promise<PlatformBillingConfig> {
  return getJson<PlatformBillingConfig>("/platform-config", { signal, token });
}

export function updatePlatformBillingConfig(
  input: UpdatePlatformBillingConfigInput,
  token: string,
): Promise<PlatformBillingConfig> {
  return patchJson<PlatformBillingConfig>(
    "/platform-config",
    input,
    { token },
    "บันทึกค่าบริการแพลตฟอร์มไม่สำเร็จ",
  );
}

export function createSuperAdminOrganization(
  input: CreateSuperAdminOrganizationInput,
  token: string,
): Promise<SuperAdminOrganization> {
  return postJson<SuperAdminOrganization>(
    "/organizations",
    input,
    { token },
    "สร้างองค์กรไม่สำเร็จ",
  );
}

export function updateSuperAdminOrganizationStatus(
  organizationId: string,
  status: SuperAdminOrganizationStatus,
  token: string,
): Promise<SuperAdminOrganization> {
  return patchJson<SuperAdminOrganization>(
    `/organizations/${encodeURIComponent(organizationId)}/status`,
    { status },
    { token },
    "เปลี่ยนสถานะองค์กรไม่สำเร็จ",
  );
}

export function getSuperAdminCompanyAdmins(
  token: string,
  signal?: AbortSignal,
): Promise<SuperAdminCompanyAdmin[]> {
  return getJson<SuperAdminCompanyAdmin[]>("/admins", { signal, token });
}

export function getSuperAdminUsers(
  token: string,
  signal?: AbortSignal,
): Promise<SuperAdminUserListItem[]> {
  return getJson<SuperAdminUserListItem[]>("/users", { signal, token });
}

export function getSuperAdminUserDetail(
  userId: string,
  token: string,
  signal?: AbortSignal,
): Promise<SuperAdminUserDetail> {
  return getJson<SuperAdminUserDetail>(`/users/${encodeURIComponent(userId)}`, {
    signal,
    token,
  });
}

export function getSuperAdminUserLastLogin(
  userId: string,
  token: string,
  signal?: AbortSignal,
): Promise<SuperAdminUserLastLogin> {
  return getJson<SuperAdminUserLastLogin>(
    `/users/${encodeURIComponent(userId)}/last-login`,
    { signal, token },
  );
}

export function getSuperAdminBookings(
  token: string,
  signal?: AbortSignal,
): Promise<SuperAdminBooking[]> {
  return getJson<SuperAdminBooking[]>("/bookings/all", { signal, token });
}

export function getSuperAdminRefunds(
  token: string,
  signal?: AbortSignal,
): Promise<SuperAdminRefund[]> {
  return getJson<SuperAdminRefund[]>("/refunds/all", { signal, token });
}

export function getSuperAdminSupportTickets(
  token: string,
  signal?: AbortSignal,
): Promise<SuperAdminSupportTicket[]> {
  return getJson<SuperAdminSupportTicket[]>("/support-tickets/all", {
    signal,
    token,
  });
}

export function getSuperAdminPenalties(
  token: string,
  signal?: AbortSignal,
): Promise<SuperAdminPenaltiesOverview> {
  return getJson<SuperAdminPenaltiesOverview>("/penalties/all", {
    signal,
    token,
  });
}

export function getSuperAdminAnnouncements(
  token: string,
  signal?: AbortSignal,
): Promise<SuperAdminAnnouncement[]> {
  return getJson<SuperAdminAnnouncement[]>("/announcements/all", {
    signal,
    token,
  });
}

export function getSuperAdminAuditLogs(
  token: string,
  signal?: AbortSignal,
  filter: SuperAdminAuditLogFilter = {},
): Promise<SuperAdminAuditLog[]> {
  const search = new URLSearchParams();
  if (filter.action) search.set("action", filter.action);
  if (filter.actorUserId) search.set("actorUserId", filter.actorUserId);
  const query = search.toString();
  return getJson<SuperAdminAuditLog[]>(
    query ? `/audit-logs?${query}` : "/audit-logs",
    { signal, token },
  );
}

/**
 * `organizationId` must come from the authenticated user's memberships in
 * GET /auth/me. The UI never accepts an arbitrary organization identifier.
 */
export function updateOrganizationPromptPay(
  organizationId: string,
  promptpayId: string,
  token: string,
  signal?: AbortSignal,
): Promise<OrganizationSettings> {
  return patchJson<OrganizationSettings>(
    "/organizations/" + encodeURIComponent(organizationId),
    { promptpayId },
    { signal, token },
    "บันทึกหมายเลข PromptPay ไม่สำเร็จ",
  );
}

export function createShop(
  input: CreateShopInput,
  token: string,
  signal?: AbortSignal,
): Promise<VendorShop> {
  return postJson<VendorShop>(
    "/shops",
    input,
    { signal, token },
    "สร้างร้านค้าไม่สำเร็จ",
  );
}

/**
 * `/shops/me` takes no id — the API resolves the shop from the token, so a
 * vendor cannot address anyone else's row.
 */
export function updateShop(
  input: UpdateShopInput,
  token: string,
  signal?: AbortSignal,
): Promise<VendorShop> {
  return patchJson<VendorShop>(
    "/shops/me",
    input,
    { signal, token },
    "บันทึกข้อมูลร้านค้าไม่สำเร็จ",
  );
}

/**
 * Uploads a shop logo through the API, not to Supabase Storage directly: the
 * bucket is written with the service-role key, which is backend-only and must
 * never reach this bundle. The API names the object and returns the shop with
 * `logoUrl` already pointing at it.
 *
 * Do not set Content-Type — the browser adds the multipart boundary for this
 * FormData body. Same shape as `uploadBookingSlip` below.
 */
export async function uploadShopLogo(
  file: File,
  token: string,
  signal?: AbortSignal,
): Promise<VendorShop> {
  if (!API_BASE_URL) {
    throw new ApiError(
      "ยังไม่ได้ตั้งค่า NEXT_PUBLIC_API_URL สำหรับ SpaceLink Web",
      0,
    );
  }

  const form = new FormData();
  form.append("file", file);

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/shops/me/logo`, {
      method: "POST",
      signal,
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: form,
    });
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === "AbortError") {
      throw cause;
    }

    throw new ApiError(
      "ไม่สามารถเชื่อมต่อ SpaceLink API เพื่ออัปโหลดโลโก้ได้ กรุณาลองใหม่อีกครั้ง",
      0,
    );
  }

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as {
      message?: string | string[];
    } | null;
    const detail = Array.isArray(payload?.message)
      ? payload.message.join(", ")
      : payload?.message;
    const fallbackByStatus: Record<number, string> = {
      400: "ไฟล์โลโก้ไม่ถูกต้อง กรุณาใช้ไฟล์ JPEG หรือ PNG",
      404: "ไม่พบร้านค้าของคุณ กรุณาสร้างร้านค้าก่อนอัปโหลดโลโก้",
      413: "ไฟล์โลโก้มีขนาดเกิน 2 MB",
      502: "บริการจัดเก็บไฟล์ยังไม่พร้อม กรุณาลองใหม่ภายหลัง",
    };

    throw new ApiError(
      detail || fallbackByStatus[response.status] || "อัปโหลดโลโก้ไม่สำเร็จ",
      response.status,
    );
  }

  return (await response.json()) as VendorShop;
}

/** Public reference data — GET /categories has no guard, so no token. */
export function getCategories(
  signal?: AbortSignal,
): Promise<ProductCategory[]> {
  return getJson<ProductCategory[]>("/categories", { signal });
}

export function updateMe(
  input: UpdateMeInput,
  token: string,
  signal?: AbortSignal,
): Promise<UserProfile> {
  return patchJson<UserProfile>(
    "/users/me",
    input,
    { signal, token },
    "บันทึกข้อมูลส่วนตัวไม่สำเร็จ",
  );
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

/**
 * Protected conversational help endpoint. The browser forwards the Supabase
 * access token and at most five recent Q/A pairs. The API verifies the token,
 * loads only that user's permitted context, and keeps Gemini credentials in
 * the backend process.
 */
export function askSupportAssistant(
  question: string,
  history: SupportAssistantHistoryMessage[],
  token: string,
  signal?: AbortSignal,
): Promise<SupportAssistantResponse> {
  return postJson<SupportAssistantResponse>(
    "/ai/support",
    { question: question.trim(), history: history.slice(-10) },
    { signal, token },
    "AI ช่วยคุณได้ยังไม่พร้อมใช้งาน กรุณาลองใหม่อีกครั้ง",
  );
}

export function createBooking(
  input: CreateBookingInput,
  token: string,
  signal?: AbortSignal,
): Promise<BookingRecord> {
  return postJson<BookingRecord>(
    "/bookings",
    input,
    { signal, token },
    "สร้างการจองไม่สำเร็จ",
  );
}

export function getMyBookings(
  token: string,
  signal?: AbortSignal,
): Promise<MyBooking[]> {
  return getJson<MyBooking[]>("/bookings", { signal, token });
}

export function getAverageRating(
  targetType: ReviewTargetType,
  targetId: string,
  signal?: AbortSignal,
): Promise<AverageRating> {
  return getJson<AverageRating>(
    "/reviews/average?targetType=" +
      targetType +
      "&targetId=" +
      encodeURIComponent(targetId),
    { signal },
  );
}

export function createReview(
  input: CreateReviewInput,
  token: string,
): Promise<unknown> {
  return postJson("/reviews", input, { token }, "ไม่สามารถบันทึกคะแนนได้");
}

export function getPenaltyHistory(
  bookingId: string,
  token: string,
  signal?: AbortSignal,
): Promise<PenaltyHistory> {
  return getJson<PenaltyHistory>(
    `/bookings/${encodeURIComponent(bookingId)}/penalties`,
    { signal, token },
  );
}

export function createPenalty(
  bookingId: string,
  input: CreatePenaltyInput,
  token: string,
  signal?: AbortSignal,
): Promise<CreatePenaltyResult> {
  return postJson<CreatePenaltyResult>(
    `/bookings/${encodeURIComponent(bookingId)}/penalties`,
    input,
    { signal, token },
    "ไม่สามารถออกแต้มโทษได้",
  );
}

export function cancelBooking(
  bookingId: string,
  cancelReason: string,
  token: string,
  signal?: AbortSignal,
): Promise<BookingRecord> {
  return patchJson<BookingRecord>(
    `/bookings/${encodeURIComponent(bookingId)}/cancel`,
    { cancelReason: cancelReason.trim() },
    { signal, token },
    "ยกเลิกการจองไม่สำเร็จ",
  );
}

/**
 * Looks up the booking code an organizer receives from a vendor. The API
 * applies the organization-membership filter; the browser never attempts to
 * infer or send an organization id itself.
 */
export function getAdminBookingByCode(
  bookingCode: string,
  token: string,
  signal?: AbortSignal,
): Promise<BookingRecord> {
  return getJson<BookingRecord>(
    `/bookings/by-code/${encodeURIComponent(bookingCode.trim())}`,
    { signal, token },
  );
}

/** Confirms a pending booking without a payment slip, with an audit reason. */
export function confirmExemptBooking(
  bookingId: string,
  paymentExemptReason: string,
  token: string,
  signal?: AbortSignal,
): Promise<BookingRecord> {
  return patchJson<BookingRecord>(
    `/bookings/${encodeURIComponent(bookingId)}/confirm-exempt`,
    { paymentExemptReason: paymentExemptReason.trim() },
    { signal, token },
    "ยืนยันการจองไม่สำเร็จ",
  );
}

/** Opens a quota-exception request for the organization that owns the event. */
export function createSupportTicket(
  input: CreateSupportTicketInput,
  token: string,
  signal?: AbortSignal,
): Promise<SupportTicketRecord> {
  return postJson<SupportTicketRecord>(
    "/support-tickets",
    {
      eventId: input.eventId.trim(),
      subject: input.subject.trim(),
      message: input.message.trim(),
    },
    { signal, token },
    "ไม่สามารถส่งคำร้องขอเพิ่มโควตาได้",
  );
}

/** Approves one request; the API derives the organization from the ticket. */
export function approveQuotaException(
  ticketId: string,
  input: ApproveQuotaExceptionInput,
  token: string,
  signal?: AbortSignal,
): Promise<BookingRecord> {
  return patchJson<BookingRecord>(
    `/support-tickets/${encodeURIComponent(ticketId.trim())}/approve-quota-exception`,
    {
      eventId: input.eventId.trim(),
      boothId: input.boothId.trim(),
    },
    { signal, token },
    "ไม่สามารถอนุมัติคำร้องขอเพิ่มโควตาได้",
  );
}

/**
 * Uploads a payment slip to the guarded booking endpoint.
 *
 * Do not set Content-Type here. The browser must add the multipart boundary
 * generated for this FormData body. The API owns storage and verification;
 * the web app must never upload directly with a Supabase service-role key.
 */
export async function uploadBookingSlip(
  bookingId: string,
  file: File,
  token: string,
  signal?: AbortSignal,
): Promise<SlipUploadResponse> {
  if (!API_BASE_URL) {
    throw new ApiError(
      "ยังไม่ได้ตั้งค่า NEXT_PUBLIC_API_URL สำหรับ SpaceLink Web",
      0,
    );
  }

  const form = new FormData();
  form.append("file", file);

  let response: Response;
  try {
    response = await fetch(
      `${API_BASE_URL}/bookings/${encodeURIComponent(bookingId)}/slip`,
      {
        method: "POST",
        signal,
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: form,
      },
    );
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === "AbortError") {
      throw cause;
    }

    throw new ApiError(
      "ไม่สามารถเชื่อมต่อ SpaceLink API เพื่ออัปโหลดสลิปได้ กรุณาลองใหม่อีกครั้ง",
      0,
    );
  }

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as {
      message?: string | string[];
    } | null;
    const detail = Array.isArray(payload?.message)
      ? payload.message.join(", ")
      : payload?.message;
    const fallbackByStatus: Record<number, string> = {
      400: "ไฟล์สลิปไม่ถูกต้อง กรุณาใช้ไฟล์ JPEG หรือ PNG",
      404: "ไม่พบรายการจองนี้ หรือคุณไม่มีสิทธิ์เข้าถึง",
      409: "รายการจองหมดเวลาหรืออยู่ในสถานะที่อัปโหลดสลิปไม่ได้",
      413: "ไฟล์สลิปมีขนาดเกิน 5 MB",
      502: "บริการจัดเก็บหรือตรวจสอบสลิปยังไม่พร้อม กรุณาลองใหม่ภายหลัง",
    };

    throw new ApiError(
      detail || fallbackByStatus[response.status] || "อัปโหลดสลิปไม่สำเร็จ",
      response.status,
    );
  }

  return (await response.json()) as SlipUploadResponse;
}
