'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Suspense,
  type FormEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  AlertCircle,
  BarChart3,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  FileText,
  Headphones,
  Info,
  ListFilter,
  MessageCircleWarning,
  Paperclip,
  Search,
  Send,
  ShieldCheck,
  X,
} from 'lucide-react';
import {
  ApiError,
  createOrganizationAdminSupportTicket,
  createSupportTicket,
  getBooths,
  getEventMap,
  getMySupportTicketDetail,
  getMySupportTickets,
  getMyBookings,
  getMe,
  type BoothOption,
  type EventMap,
  type MyBooking,
  type SupportTicketRecord,
  type UserRole,
  type VendorSupportTicket,
  type VendorSupportTicketDetail,
} from '@/lib/api';
import { useAdminOrganizationSelection } from '@/components/app-shell';
import { getSupabaseBrowserClient } from '@/lib/supabase';
import { getUxPreviewMode, UX_PREVIEW_TOKEN } from '@/lib/ux-preview';
import {
  parseQuotaRequestQuery,
  resolveQuotaRequestContext,
  type ParsedQuotaRequestQuery,
  type QuotaBoothOption,
  type QuotaRequestOption,
} from '@/lib/quota-request-context';

type AccessState =
  | { status: 'loading' }
  | { status: 'signed-out' }
  | { status: 'ready'; token: string; role: UserRole }
  | { status: 'error'; message: string };

const inputClass =
  'mt-2 h-12 w-full rounded-2xl border border-[#ded5eb] bg-[#fcfbff] px-4 text-base text-ink outline-none transition focus:border-violet focus:ring-4 focus:ring-[#7c3aed18]';

type VendorRequestType = 'QUOTA_INCREASE' | 'ISSUE_REPORT';

type VendorTab = VendorRequestType | 'TRACKING';
type IssueKind = 'PAYMENT' | 'BOOKING' | 'UPLOAD' | 'ACCOUNT' | 'OTHER';
type IssuePriority = 'NORMAL' | 'URGENT';

const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
const ACCEPTED_ATTACHMENT_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'application/pdf',
]);

const ACTIVE_BOOKING_STATUSES = new Set(['PENDING_PAYMENT', 'CONFIRMED']);

const PREVIEW_BOOKINGS: MyBooking[] = [
  {
    id: 'preview-booking-a01',
    bookingCode: 'BK-PREVIEW-A01',
    eventId: 'preview-event',
    boothId: 'preview-booth-a01',
    shopId: 'preview-shop',
    vendorUserId: 'preview-vendor',
    bookingStartDate: '2026-09-10T00:00:00.000Z',
    bookingEndDate: '2026-09-12T00:00:00.000Z',
    boothPrice: '6500',
    isPaymentExempt: false,
    paymentExemptReason: null,
    status: 'CONFIRMED',
    holdExpiresAt: null,
    confirmedAt: '2026-08-31T00:00:00.000Z',
    cancelReason: null,
    cancelledAt: null,
    createdAt: '2026-08-31T00:00:00.000Z',
    updatedAt: '2026-08-31T00:00:00.000Z',
    paymentQrDataUri: null,
    event: {
      id: 'preview-event',
      name: 'Future Tech Expo 2026',
      endDate: '2026-09-12T00:00:00.000Z',
      endTime: '18:00',
    },
    booth: {
      id: 'preview-booth-a01',
      code: 'A01',
      zone: { id: 'preview-zone-a', code: 'A', name: 'โซนอาหาร' },
    },
    shop: { id: 'preview-shop', name: 'ร้านตัวอย่าง' },
  },
];

const PREVIEW_BOOTH_OPTIONS: BoothOption[] = [
  {
    id: 'preview-booth-a02',
    zoneId: 'preview-zone-a',
    code: 'A02',
    boothPrice: '6500',
    widthM: '3',
    heightM: '2.5',
    facilities: null,
    posX: null,
    posY: null,
    status: 'AVAILABLE',
    createdAt: '2026-08-31T00:00:00.000Z',
    updatedAt: '2026-08-31T00:00:00.000Z',
  },
  {
    id: 'preview-booth-a03',
    zoneId: 'preview-zone-a',
    code: 'A03',
    boothPrice: '6500',
    widthM: '4',
    heightM: '3',
    facilities: null,
    posX: null,
    posY: null,
    status: 'AVAILABLE',
    createdAt: '2026-08-31T00:00:00.000Z',
    updatedAt: '2026-08-31T00:00:00.000Z',
  },
];

const PREVIEW_EVENT_MAP = {
  event: {
    id: 'preview-event',
    slug: 'preview-event',
    name: 'Future Tech Expo 2026',
    description: null,
    startDate: '2026-09-10T00:00:00.000Z',
    endDate: '2026-09-12T00:00:00.000Z',
    startTime: '09:00',
    endTime: '18:00',
    bannerUrl: null,
    galleryUrls: [],
    status: 'ONGOING',
    mapImageUrl: null,
    contactPhone: null,
    contactEmail: null,
    organization: {
      id: 'preview-organization',
      name: 'องค์กรตัวอย่าง',
      contactEmail: 'preview@spacelink.local',
      contactPhone: null,
      facebookUrl: null,
      lineUrl: null,
      logoUrl: null,
    },
    venue: { id: 'preview-venue', name: 'พื้นที่ตัวอย่าง', address: null },
    policy: null,
    joinInformation: [],
    information: [],
  },
  zones: [
    {
      id: 'preview-zone-a',
      code: 'A',
      name: 'โซนอาหาร',
      description: null,
      posX: null,
      posY: null,
      categories: [],
      booths: PREVIEW_BOOTH_OPTIONS.map((booth) => ({
        ...booth,
        availability:
          booth.id === 'preview-booth-a03'
            ? ('BOOKED' as const)
            : ('AVAILABLE' as const),
        tier: null,
        occupant: null,
      })),
    },
  ],
} as EventMap;

const PREVIEW_TICKETS: VendorSupportTicket[] = [
  {
    id: 'QT-2026-001',
    type: 'OTHER',
    subject: 'ขอโควต้าบูธเพิ่ม',
    status: 'OPEN',
    createdAt: '2026-09-14T09:30:00.000Z',
    updatedAt: '2026-09-14T09:30:00.000Z',
    organization: { id: 'preview-organization', name: 'SpaceLink Fair' },
    booking: PREVIEW_BOOKINGS[0]
      ? {
          id: PREVIEW_BOOKINGS[0].id,
          bookingCode: PREVIEW_BOOKINGS[0].bookingCode,
          event: PREVIEW_BOOKINGS[0].event,
          booth: PREVIEW_BOOKINGS[0].booth,
        }
      : null,
    quotaGrant: null,
  },
  {
    id: 'IS-2026-002',
    type: 'ISSUE_REPORT',
    subject: 'ตรวจสอบสถานะการชำระเงิน',
    status: 'CLOSED',
    createdAt: '2026-09-10T10:15:00.000Z',
    updatedAt: '2026-09-11T08:00:00.000Z',
    organization: { id: 'preview-organization', name: 'SpaceLink Fair' },
    booking: PREVIEW_BOOKINGS[0]
      ? {
          id: PREVIEW_BOOKINGS[0].id,
          bookingCode: PREVIEW_BOOKINGS[0].bookingCode,
          event: PREVIEW_BOOKINGS[0].event,
          booth: PREVIEW_BOOKINGS[0].booth,
        }
      : null,
    quotaGrant: null,
  },
  {
    id: 'QT-2026-003',
    type: 'OTHER',
    subject: 'ขอโควต้าบูธเพิ่ม',
    status: 'CLOSED',
    createdAt: '2026-09-05T04:40:00.000Z',
    updatedAt: '2026-09-06T06:20:00.000Z',
    organization: { id: 'preview-organization', name: 'SpaceLink Fair' },
    booking: PREVIEW_BOOKINGS[0]
      ? {
          id: PREVIEW_BOOKINGS[0].id,
          bookingCode: PREVIEW_BOOKINGS[0].bookingCode,
          event: PREVIEW_BOOKINGS[0].event,
          booth: PREVIEW_BOOKINGS[0].booth,
        }
      : null,
    quotaGrant: { id: 'preview-grant', consumedAt: null },
  },
  {
    id: 'QT-2026-004',
    type: 'OTHER',
    subject: 'ขอโควต้าบูธเพิ่ม',
    status: 'CLOSED',
    createdAt: '2026-09-02T03:20:00.000Z',
    updatedAt: '2026-09-03T05:00:00.000Z',
    organization: { id: 'preview-organization', name: 'SpaceLink Fair' },
    booking: PREVIEW_BOOKINGS[0]
      ? {
          id: PREVIEW_BOOKINGS[0].id,
          bookingCode: PREVIEW_BOOKINGS[0].bookingCode,
          event: PREVIEW_BOOKINGS[0].event,
          booth: PREVIEW_BOOKINGS[0].booth,
        }
      : null,
    quotaGrant: null,
  },
];

export function SupportTicketScreen() {
  return (
    <Suspense
      fallback={
        <section className="sl-surface mt-8 p-6" aria-busy="true">
          <p className="text-sm font-semibold text-muted">
            กำลังเตรียมแบบฟอร์มช่วยเหลือ
          </p>
        </section>
      }
    >
      <SupportTicketScreenContent />
    </Suspense>
  );
}

function SupportTicketScreenContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const quotaRequestQuery = useMemo(
    () => parseQuotaRequestQuery(searchParams),
    [searchParams],
  );
  const [access, setAccess] = useState<AccessState>({ status: 'loading' });

  useEffect(() => {
    const previewMode = getUxPreviewMode();
    if (previewMode) {
      setAccess(
        previewMode === 'signed-in'
          ? { status: 'ready', token: UX_PREVIEW_TOKEN, role: 'VENDOR' }
          : { status: 'signed-out' },
      );
      return;
    }

    const controller = new AbortController();
    let active = true;

    void (async () => {
      try {
        const supabase = getSupabaseBrowserClient();
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        if (!token) {
          if (active) setAccess({ status: 'signed-out' });
          return;
        }

        const me = await getMe(token, controller.signal);
        if (active) setAccess({ status: 'ready', token, role: me.role });
      } catch (cause) {
        if (cause instanceof DOMException && cause.name === 'AbortError')
          return;
        if (active) {
          setAccess({
            status: 'error',
            message: describeError(cause, 'ตรวจสอบสิทธิ์ใช้งานไม่สำเร็จ'),
          });
        }
      }
    })();

    return () => {
      active = false;
      controller.abort();
    };
  }, []);

  if (access.status === 'loading') {
    return (
      <section className="sl-surface mt-8 p-6" aria-busy="true">
        <p className="text-sm font-semibold text-muted">
          กำลังตรวจสอบสิทธิ์สำหรับคำร้องขอโควตา
        </p>
      </section>
    );
  }

  if (access.status === 'signed-out') {
    return (
      <section className="sl-soft-surface mt-8 p-6 sm:p-8">
        <h2 className="text-xl font-black text-ink">ติดต่อสอบถาม</h2>
        <p className="mt-2 text-sm leading-6 text-muted">
          กรุณาเข้าสู่ระบบก่อนแจ้งปัญหา ขอเพิ่มโควต้า หรือติดตามคำร้อง
        </p>
        <button
          type="button"
          onClick={() => router.push('/login')}
          className="sl-action-primary mt-5"
        >
          เข้าสู่ระบบ
        </button>
      </section>
    );
  }

  if (access.status === 'error') {
    return (
      <section className="mt-8 rounded-3xl border border-red-200 bg-red-50 p-6 text-red-800">
        <div className="flex items-start gap-3">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
          <p>{access.message}</p>
        </div>
      </section>
    );
  }

  if (access.role === 'VENDOR') {
    return (
      <VendorTicketForm
        token={access.token}
        preview={access.token === UX_PREVIEW_TOKEN}
        quotaRequestQuery={quotaRequestQuery}
      />
    );
  }

  if (access.role === 'ORG_ADMIN') {
    return <OrganizationAdminTicketForm token={access.token} />;
  }

  return <SuperAdminSupportPointer />;
}

function VendorTicketForm({
  token,
  preview,
  quotaRequestQuery,
}: {
  token: string;
  preview: boolean;
  quotaRequestQuery: ParsedQuotaRequestQuery;
}) {
  const [activeTab, setActiveTab] = useState<VendorTab>(
    quotaRequestQuery.status === 'ready' ? 'QUOTA_INCREASE' : 'ISSUE_REPORT',
  );
  const [bookings, setBookings] = useState<MyBooking[]>([]);
  const [loadingBookings, setLoadingBookings] = useState(true);
  const [bookingsError, setBookingsError] = useState<string | null>(null);
  const [quotaContext, setQuotaContext] = useState('');
  const [boothOptions, setBoothOptions] = useState<QuotaBoothOption[]>([]);
  const [loadingBooths, setLoadingBooths] = useState(false);
  const [boothError, setBoothError] = useState<string | null>(null);
  const [requestedBoothId, setRequestedBoothId] = useState('');
  const [contextOption, setContextOption] = useState<QuotaRequestOption | null>(
    null,
  );
  const [contextBooths, setContextBooths] = useState<QuotaBoothOption[]>([]);
  const [contextRequestedBoothId, setContextRequestedBoothId] = useState('');
  const [contextNotice, setContextNotice] = useState<string | null>(null);
  const [contextError, setContextError] = useState<string | null>(null);
  const [issueBookingId, setIssueBookingId] = useState('');
  const [issueKind, setIssueKind] = useState<IssueKind>('PAYMENT');
  const [issuePriority, setIssuePriority] = useState<IssuePriority>('NORMAL');
  const [issueSubject, setIssueSubject] = useState('');
  const [issueDetail, setIssueDetail] = useState('');
  const [quotaReason, setQuotaReason] = useState('');
  const [attachment, setAttachment] = useState<File | null>(null);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ticket, setTicket] = useState<SupportTicketRecord | null>(null);
  const [tickets, setTickets] = useState<VendorSupportTicket[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(true);
  const [ticketsError, setTicketsError] = useState<string | null>(null);
  const [ticketSearch, setTicketSearch] = useState('');
  const [ticketTypeFilter, setTicketTypeFilter] = useState('ALL');
  const [ticketStatusFilter, setTicketStatusFilter] = useState('ALL');
  const [ticketSort, setTicketSort] = useState<'NEWEST' | 'OLDEST'>('NEWEST');
  const [detail, setDetail] = useState<VendorSupportTicketDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const activeBookings = bookings.filter((booking) =>
    ACTIVE_BOOKING_STATUSES.has(booking.status),
  );
  const bookingQuotaOptions = Array.from(
    new Map(
      activeBookings.map((booking) => {
        const key = `${booking.event.id}:${booking.booth.zone.id}`;
        return [
          key,
          {
            key,
            eventId: booking.event.id,
            eventName: booking.event.name,
            zoneId: booking.booth.zone.id,
            zoneName: booking.booth.zone.name ?? booking.booth.zone.code,
            source: 'booking' as const,
          },
        ];
      }),
    ).values(),
  );
  const quotaOptions = Array.from(
    new Map(
      [...bookingQuotaOptions, ...(contextOption ? [contextOption] : [])].map(
        (option) => [option.key, option],
      ),
    ).values(),
  );
  const selectedQuotaOption = quotaOptions.find(
    (option) => option.key === quotaContext,
  );
  const selectedQuotaZoneId = selectedQuotaOption?.zoneId ?? '';
  const selectedQuotaBookings = selectedQuotaOption
    ? activeBookings.filter(
        (booking) =>
          booking.event.id === selectedQuotaOption.eventId &&
          (selectedQuotaOption.source === 'context' ||
            booking.booth.zone.id === selectedQuotaOption.zoneId),
      )
    : [];

  const loadTickets = useCallback(
    async (signal?: AbortSignal) => {
      setLoadingTickets(true);
      setTicketsError(null);
      try {
        const loaded = preview
          ? PREVIEW_TICKETS
          : await getMySupportTickets(token, signal);
        setTickets(loaded);
      } catch (cause) {
        if (cause instanceof DOMException && cause.name === 'AbortError') {
          return;
        }
        setTicketsError(describeError(cause, 'โหลดรายการคำร้องไม่สำเร็จ'));
      } finally {
        if (!signal?.aborted) setLoadingTickets(false);
      }
    },
    [preview, token],
  );

  useEffect(() => {
    const controller = new AbortController();
    void loadTickets(controller.signal);
    return () => controller.abort();
  }, [loadTickets]);

  useEffect(() => {
    if (quotaRequestQuery.status === 'ready') {
      setActiveTab('QUOTA_INCREASE');
    }
  }, [quotaRequestQuery.status]);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    void (async () => {
      try {
        const loaded = preview
          ? PREVIEW_BOOKINGS
          : await getMyBookings(token, controller.signal);
        if (!active) return;
        setBookings(loaded);
        setContextOption(null);
        setContextBooths([]);
        setContextRequestedBoothId('');
        setContextNotice(null);
        setContextError(null);

        if (quotaRequestQuery.status === 'invalid') {
          setQuotaContext('');
          setContextError(quotaRequestQuery.message);
          return;
        }
        if (quotaRequestQuery.status === 'ready') {
          const eventMap =
            preview && quotaRequestQuery.value.eventId === 'preview-event'
              ? PREVIEW_EVENT_MAP
              : await getEventMap(
                  quotaRequestQuery.value.eventId,
                  controller.signal,
                );
          if (!active) return;
          const resolved = resolveQuotaRequestContext({
            query: quotaRequestQuery.value,
            eventMap,
            bookings: loaded,
          });
          if (resolved.status === 'error') {
            setQuotaContext('');
            setContextError(resolved.message);
            return;
          }
          setContextOption(resolved.option);
          setContextBooths(resolved.booths);
          setContextRequestedBoothId(resolved.requestedBoothId);
          setContextNotice(resolved.notice);
          setQuotaContext(resolved.option.key);
          return;
        }

        const firstActive = loaded.find((booking) =>
          ACTIVE_BOOKING_STATUSES.has(booking.status),
        );
        if (firstActive) {
          setQuotaContext(
            `${firstActive.event.id}:${firstActive.booth.zone.id}`,
          );
        }
      } catch (cause) {
        if (cause instanceof DOMException && cause.name === 'AbortError')
          return;
        if (active) {
          setBookingsError(describeError(cause, 'โหลดข้อมูลการจองไม่สำเร็จ'));
        }
      } finally {
        if (active) setLoadingBookings(false);
      }
    })();

    return () => {
      active = false;
      controller.abort();
    };
  }, [preview, quotaRequestQuery, token]);

  useEffect(() => {
    if (activeTab !== 'QUOTA_INCREASE' || !selectedQuotaZoneId) {
      setBoothOptions([]);
      setRequestedBoothId('');
      setBoothError(null);
      return;
    }

    if (contextOption?.key === quotaContext) {
      setBoothOptions(contextBooths);
      setRequestedBoothId(contextRequestedBoothId);
      setBoothError(contextNotice);
      setLoadingBooths(false);
      return;
    }

    const controller = new AbortController();
    let active = true;
    setLoadingBooths(true);
    setBoothError(null);

    void (async () => {
      try {
        const loaded = preview
          ? PREVIEW_BOOTH_OPTIONS.filter(
              (booth) => booth.zoneId === selectedQuotaZoneId,
            )
          : await getBooths(selectedQuotaZoneId, controller.signal);
        if (!active) return;
        const available = loaded.filter(
          (booth) => booth.status === 'AVAILABLE',
        );
        setBoothOptions(available);
        setRequestedBoothId(available[0]?.id ?? '');
      } catch (cause) {
        if (cause instanceof DOMException && cause.name === 'AbortError')
          return;
        if (active) {
          setBoothError(describeError(cause, 'โหลดข้อมูลบูธไม่สำเร็จ'));
          setBoothOptions([]);
          setRequestedBoothId('');
        }
      } finally {
        if (active) setLoadingBooths(false);
      }
    })();

    return () => {
      active = false;
      controller.abort();
    };
  }, [
    contextBooths,
    contextNotice,
    contextOption,
    contextRequestedBoothId,
    preview,
    quotaContext,
    activeTab,
    selectedQuotaZoneId,
  ]);

  function changeTab(nextTab: VendorTab) {
    setActiveTab(nextTab);
    setError(null);
    setTicket(null);
    setAttachment(null);
    setAttachmentError(null);
  }

  function changeQuotaContext(nextContext: string) {
    setQuotaContext(nextContext);
    setRequestedBoothId('');
  }

  function changeAttachment(file: File | null) {
    setAttachmentError(null);
    if (!file) {
      setAttachment(null);
      return;
    }
    if (!ACCEPTED_ATTACHMENT_TYPES.has(file.type)) {
      setAttachment(null);
      setAttachmentError('รองรับเฉพาะไฟล์ JPG, PNG หรือ PDF');
      return;
    }
    if (file.size > MAX_ATTACHMENT_BYTES) {
      setAttachment(null);
      setAttachmentError('ไฟล์ต้องมีขนาดไม่เกิน 10 MB');
      return;
    }
    setAttachment(file);
  }

  async function openTicketDetail(ticketId: string) {
    setDetailLoading(true);
    setDetailError(null);
    try {
      if (preview) {
        const selected = tickets.find((item) => item.id === ticketId);
        if (!selected) throw new Error('missing preview ticket');
        setDetail({
          ...selected,
          messages: [
            {
              id: `${ticketId}-message`,
              message:
                selected.type === 'OTHER'
                  ? 'ต้องการเพิ่มโควตาอีก 1 บูธสำหรับงานนี้'
                  : 'กรุณาช่วยตรวจสอบรายการที่แจ้งไว้',
              createdAt: selected.createdAt,
              sender: { id: 'preview-vendor', fullName: 'Vithavin' },
            },
          ],
        });
      } else {
        setDetail(await getMySupportTicketDetail(ticketId, token));
      }
    } catch (cause) {
      setDetailError(describeError(cause, 'โหลดรายละเอียดคำร้องไม่สำเร็จ'));
    } finally {
      setDetailLoading(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (activeTab === 'TRACKING') return;

    if (
      activeTab === 'ISSUE_REPORT' &&
      (!issueSubject.trim() || !issueDetail.trim())
    ) {
      setError('กรุณากรอกหัวข้อและรายละเอียดให้ครบ');
      return;
    }
    if (
      activeTab === 'QUOTA_INCREASE' &&
      (!selectedQuotaOption || !requestedBoothId || !quotaReason.trim())
    ) {
      setError('กรุณาเลือกงาน โซน บูธ และระบุเหตุผลให้ครบ');
      return;
    }
    if (attachmentError) {
      setError('กรุณาแก้ไขไฟล์อ้างอิงก่อนส่งคำร้อง');
      return;
    }

    setSubmitting(true);
    setError(null);
    setTicket(null);
    try {
      const requestType: VendorRequestType = activeTab;
      const subject =
        activeTab === 'QUOTA_INCREASE'
          ? 'ขอโควต้าบูธเพิ่ม'
          : issueSubject.trim();
      const message =
        activeTab === 'QUOTA_INCREASE'
          ? [
              'จำนวนที่ขอเพิ่ม: 1 บูธ',
              attachment ? `ไฟล์อ้างอิง: ${attachment.name}` : null,
              '',
              quotaReason.trim(),
            ]
              .filter((line): line is string => line !== null)
              .join('\n')
          : [
              `ประเภทปัญหา: ${issueKindLabel(issueKind)}`,
              `ความสำคัญ: ${issuePriorityLabel(issuePriority)}`,
              attachment ? `ไฟล์อ้างอิง: ${attachment.name}` : null,
              '',
              issueDetail.trim(),
            ]
              .filter((line): line is string => line !== null)
              .join('\n');
      const created = preview
        ? {
            id: `${requestType === 'QUOTA_INCREASE' ? 'QT' : 'IS'}-${Date.now()}`,
            userId: 'preview-vendor',
            organizationId: null,
            bookingId: null,
            type: requestType === 'QUOTA_INCREASE' ? 'OTHER' : 'ISSUE_REPORT',
            subject,
            status: 'OPEN' as const,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }
        : requestType === 'QUOTA_INCREASE' && selectedQuotaOption
          ? await createSupportTicket(
              {
                requestType,
                eventId: selectedQuotaOption.eventId,
                zoneId: selectedQuotaOption.zoneId,
                boothId: requestedBoothId,
                subject,
                message,
              },
              token,
            )
          : await createSupportTicket(
              {
                requestType: 'ISSUE_REPORT',
                bookingId: issueBookingId || undefined,
                subject,
                message,
              },
              token,
            );
      setTicket(created);
      if (activeTab === 'ISSUE_REPORT') {
        setIssueSubject('');
        setIssueDetail('');
      } else {
        setQuotaReason('');
      }
      setAttachment(null);
      if (preview) {
        setTickets((current) => [
          {
            id: created.id,
            type: created.type,
            subject: created.subject,
            status: created.status,
            createdAt: created.createdAt,
            updatedAt: created.updatedAt,
            organization: {
              id: 'preview-organization',
              name: 'SpaceLink Fair',
            },
            booking:
              (bookings.find((booking) => booking.id === issueBookingId) ??
              PREVIEW_BOOKINGS[0])
                ? {
                    id:
                      bookings.find((booking) => booking.id === issueBookingId)
                        ?.id ?? PREVIEW_BOOKINGS[0].id,
                    bookingCode:
                      bookings.find((booking) => booking.id === issueBookingId)
                        ?.bookingCode ?? PREVIEW_BOOKINGS[0].bookingCode,
                    event:
                      bookings.find((booking) => booking.id === issueBookingId)
                        ?.event ?? PREVIEW_BOOKINGS[0].event,
                    booth:
                      bookings.find((booking) => booking.id === issueBookingId)
                        ?.booth ?? PREVIEW_BOOKINGS[0].booth,
                  }
                : null,
            quotaGrant: null,
          },
          ...current,
        ]);
      } else {
        await loadTickets();
      }
    } catch (cause) {
      setError(describeError(cause, 'ส่งคำร้องไม่สำเร็จ'));
    } finally {
      setSubmitting(false);
    }
  }

  const filteredTickets = useMemo(() => {
    const keyword = ticketSearch.trim().toLocaleLowerCase('th');
    return tickets
      .filter((item) => {
        const kind = item.type === 'OTHER' ? 'QUOTA' : 'ISSUE';
        const status = vendorTicketStatus(item).key;
        const searchable = [
          item.id,
          item.subject,
          item.organization?.name,
          item.booking?.bookingCode,
          item.booking?.event.name,
        ]
          .filter(Boolean)
          .join(' ')
          .toLocaleLowerCase('th');
        return (
          (!keyword || searchable.includes(keyword)) &&
          (ticketTypeFilter === 'ALL' || ticketTypeFilter === kind) &&
          (ticketStatusFilter === 'ALL' || ticketStatusFilter === status)
        );
      })
      .sort((left, right) => {
        const delta =
          new Date(right.createdAt).getTime() -
          new Date(left.createdAt).getTime();
        return ticketSort === 'NEWEST' ? delta : -delta;
      });
  }, [ticketSearch, ticketSort, ticketStatusFilter, ticketTypeFilter, tickets]);

  const counts = useMemo(
    () => ({
      total: tickets.length,
      pending: tickets.filter(
        (item) => vendorTicketStatus(item).key === 'PENDING',
      ).length,
      approved: tickets.filter(
        (item) => vendorTicketStatus(item).key === 'APPROVED',
      ).length,
      rejected: tickets.filter(
        (item) => vendorTicketStatus(item).key === 'REJECTED',
      ).length,
    }),
    [tickets],
  );

  return (
    <section aria-labelledby="vendor-request-heading" className="mt-1">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-violet">
            Vendor support
          </p>
          <h1
            id="vendor-request-heading"
            className="mt-2 text-3xl font-black tracking-[-0.04em] text-ink sm:text-4xl"
          >
            ติดต่อสอบถาม
          </h1>
          <p className="mt-2 text-sm leading-6 text-muted sm:text-base">
            แจ้งปัญหา ขอเพิ่มโควต้า และติดตามทุกคำขอได้ในที่เดียว
          </p>
        </div>
        {preview ? (
          <span className="rounded-full bg-violet-tint px-4 py-2 text-xs font-bold text-violet">
            โหมดตรวจ UX/UI
          </span>
        ) : null}
      </div>

      <div
        role="tablist"
        aria-label="ประเภทการติดต่อ"
        className="mt-7 grid gap-3 md:grid-cols-3"
      >
        <SupportTab
          active={activeTab === 'ISSUE_REPORT'}
          icon={MessageCircleWarning}
          title="แจ้งปัญหา"
          description="แจ้งปัญหาการใช้งานหรือการจอง"
          onClick={() => changeTab('ISSUE_REPORT')}
        />
        <SupportTab
          active={activeTab === 'QUOTA_INCREASE'}
          icon={FileText}
          title="ขอเพิ่มโควต้า"
          description="ขอสิทธิ์จองบูธเพิ่มอีก 1 รายการ"
          onClick={() => changeTab('QUOTA_INCREASE')}
        />
        <SupportTab
          active={activeTab === 'TRACKING'}
          icon={BarChart3}
          title="ติดตามสถานะคำขอ"
          description={`${counts.pending} รายการกำลังดำเนินการ`}
          onClick={() => changeTab('TRACKING')}
        />
      </div>

      <div className="mt-5 grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_330px]">
        <div className="sl-surface p-5 sm:p-7">
          {activeTab === 'TRACKING' ? (
            <TrackingPanel
              counts={counts}
              loading={loadingTickets}
              error={ticketsError}
              tickets={filteredTickets}
              search={ticketSearch}
              typeFilter={ticketTypeFilter}
              statusFilter={ticketStatusFilter}
              sort={ticketSort}
              onSearch={setTicketSearch}
              onTypeFilter={setTicketTypeFilter}
              onStatusFilter={setTicketStatusFilter}
              onSort={setTicketSort}
              onOpen={(ticketId) => void openTicketDetail(ticketId)}
            />
          ) : (
            <form onSubmit={handleSubmit} className="grid gap-5">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-violet">
                  ข้อมูลคำขอ
                </p>
                <h2 className="mt-1 text-2xl font-black text-ink">
                  {activeTab === 'ISSUE_REPORT'
                    ? 'แจ้งปัญหาให้ทีมงานตรวจสอบ'
                    : 'ขอเพิ่มโควต้าการจอง'}
                </h2>
              </div>

              {activeTab === 'ISSUE_REPORT' ? (
                <>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="ประเภทปัญหา *">
                      <select
                        value={issueKind}
                        onChange={(event) =>
                          setIssueKind(event.target.value as IssueKind)
                        }
                        className={inputClass}
                        required
                      >
                        <option value="PAYMENT">การชำระเงิน</option>
                        <option value="BOOKING">การจองบูธ</option>
                        <option value="UPLOAD">การอัปโหลดไฟล์</option>
                        <option value="ACCOUNT">บัญชีและร้านค้า</option>
                        <option value="OTHER">อื่น ๆ</option>
                      </select>
                    </Field>
                    <Field label="ความสำคัญ *">
                      <select
                        value={issuePriority}
                        onChange={(event) =>
                          setIssuePriority(event.target.value as IssuePriority)
                        }
                        className={inputClass}
                        required
                      >
                        <option value="NORMAL">ปกติ</option>
                        <option value="URGENT">เร่งด่วน</option>
                      </select>
                    </Field>
                  </div>
                  <Field label="Event / Booking ที่เกี่ยวข้อง">
                    <select
                      value={issueBookingId}
                      onChange={(event) =>
                        setIssueBookingId(event.target.value)
                      }
                      className={inputClass}
                      disabled={loadingBookings}
                    >
                      <option value="">ไม่เกี่ยวข้องกับการจอง</option>
                      {bookings.map((booking) => (
                        <option key={booking.id} value={booking.id}>
                          {booking.bookingCode} — {booking.event.name} — บูธ{' '}
                          {booking.booth.code}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="หัวข้อปัญหา *">
                    <input
                      value={issueSubject}
                      onChange={(event) => setIssueSubject(event.target.value)}
                      className={inputClass}
                      maxLength={200}
                      placeholder="สรุปปัญหาสั้น ๆ"
                      required
                    />
                  </Field>
                  <Field label="รายละเอียดปัญหา *">
                    <textarea
                      value={issueDetail}
                      onChange={(event) => setIssueDetail(event.target.value)}
                      className={`${inputClass} min-h-32 py-3`}
                      maxLength={2000}
                      placeholder="อธิบายสิ่งที่พบ ขั้นตอนที่ทำ และผลลัพธ์ที่ต้องการ"
                      required
                    />
                  </Field>
                </>
              ) : (
                <>
                  {contextError ? (
                    <ErrorMessage message={contextError} />
                  ) : null}
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Event และ Zone *">
                      <select
                        value={quotaContext}
                        onChange={(event) =>
                          changeQuotaContext(event.target.value)
                        }
                        className={inputClass}
                        disabled={loadingBookings || quotaOptions.length === 0}
                        required
                      >
                        <option value="">
                          {loadingBookings
                            ? 'กำลังโหลดข้อมูลการจอง...'
                            : 'เลือก Event และ Zone'}
                        </option>
                        {quotaOptions.map((option) => (
                          <option key={option.key} value={option.key}>
                            {option.eventName} — {option.zoneName}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="บูธที่ต้องการ *">
                      <select
                        value={requestedBoothId}
                        onChange={(event) =>
                          setRequestedBoothId(event.target.value)
                        }
                        className={inputClass}
                        disabled={loadingBooths || boothOptions.length === 0}
                        required
                      >
                        <option value="">
                          {loadingBooths ? 'กำลังโหลดบูธ...' : 'เลือกบูธ'}
                        </option>
                        {boothOptions.map((booth) => (
                          <option key={booth.id} value={booth.id}>
                            บูธ {booth.code} — {formatBoothSize(booth)}
                          </option>
                        ))}
                      </select>
                    </Field>
                  </div>
                  <Field label="จำนวนที่ขอเพิ่ม">
                    <input
                      value="1 บูธ"
                      disabled
                      className={`${inputClass} cursor-not-allowed bg-[#f4f1f8] text-muted`}
                    />
                  </Field>
                  <Field label="เหตุผลที่ขอเพิ่มโควต้า *">
                    <textarea
                      value={quotaReason}
                      onChange={(event) => setQuotaReason(event.target.value)}
                      className={`${inputClass} min-h-32 py-3`}
                      maxLength={2000}
                      placeholder="อธิบายเหตุผลและแผนการใช้บูธเพิ่มเติม"
                      required
                    />
                  </Field>
                  {!loadingBooths &&
                  selectedQuotaZoneId &&
                  boothOptions.length === 0 ? (
                    <ErrorMessage message="ยังไม่มีบูธว่างในโซนนี้" />
                  ) : null}
                  {selectedQuotaBookings.length > 0 ? (
                    <div className="rounded-2xl border border-[#ded5eb] bg-violet-tint/50 p-4">
                      <p className="text-sm font-extrabold text-ink">
                        การจองปัจจุบันในบริบทนี้
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {selectedQuotaBookings.map((booking) => (
                          <span
                            key={booking.id}
                            className="rounded-full bg-white px-3 py-2 text-xs font-bold text-ink"
                          >
                            บูธ {booking.booth.code} ·{' '}
                            {bookingStatusLabel(booking.status)}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  {!loadingBookings && quotaOptions.length === 0 ? (
                    <ErrorMessage message="ยังไม่มีการจองที่ใช้งานอยู่สำหรับส่งคำขอเพิ่มโควต้า" />
                  ) : null}
                </>
              )}

              <AttachmentInput
                file={attachment}
                error={attachmentError}
                onChange={changeAttachment}
              />

              {bookingsError ? <ErrorMessage message={bookingsError} /> : null}
              {boothError ? <ErrorMessage message={boothError} /> : null}
              {error ? <ErrorMessage message={error} /> : null}
              {ticket ? (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
                  <div className="flex items-start gap-3 text-emerald-900">
                    <CheckCircle2
                      className="mt-0.5 h-5 w-5 shrink-0"
                      aria-hidden
                    />
                    <div>
                      <p className="font-extrabold">ส่งคำขอสำเร็จ</p>
                      <p className="mt-1 text-sm">
                        Request ID:{' '}
                        <strong className="break-all">{ticket.id}</strong>
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => changeTab('TRACKING')}
                    className="sl-action-secondary mt-4 text-violet"
                  >
                    ไปหน้าติดตามคำขอ
                    <ChevronRight className="h-4 w-4" aria-hidden />
                  </button>
                </div>
              ) : null}

              <button
                type="submit"
                disabled={submitting}
                className="sl-action-primary w-fit disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Send className="h-4 w-4" aria-hidden />
                {submitting
                  ? 'กำลังส่งคำร้อง...'
                  : activeTab === 'QUOTA_INCREASE'
                    ? 'ส่งคำขอเพิ่มโควต้า'
                    : 'ส่งคำขอแจ้งปัญหา'}
              </button>
            </form>
          )}
        </div>

        <aside className="grid gap-4">
          <InfoCard icon={ClipboardCheck} title="ขั้นตอนการช่วยเหลือ">
            <ol className="mt-4 grid gap-4">
              {[
                ['1', 'ส่งคำขอ', 'กรอกข้อมูลและส่งคำขอให้ทีมงาน'],
                ['2', 'ทีมงานตรวจสอบ', 'ตรวจสอบรายละเอียดและดำเนินการ'],
                ['3', 'แจ้งผลกลับ', 'ติดตามผลได้จากแท็บติดตามสถานะ'],
              ].map(([step, title, description]) => (
                <li key={step} className="flex gap-3">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-violet-tint text-sm font-black text-violet">
                    {step}
                  </span>
                  <span>
                    <strong className="block text-sm text-ink">{title}</strong>
                    <small className="mt-0.5 block leading-5 text-muted">
                      {description}
                    </small>
                  </span>
                </li>
              ))}
            </ol>
          </InfoCard>
          <InfoCard icon={Headphones} title="ข้อมูลติดต่อด่วน">
            <div className="mt-4 grid gap-3 text-sm">
              <p>
                <strong>Facebook:</strong> SpaceLink
              </p>
              <p>
                <strong>อีเมล:</strong> support@spacelink.co
              </p>
              <p>
                <strong>เวลาทำการ:</strong> จ.–ศ. 09:00–18:00 น.
              </p>
            </div>
          </InfoCard>
          <InfoCard icon={Info} title="คำแนะนำก่อนส่งคำขอ">
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-muted">
              <li>ระบุ Event หรือ Booking ให้ตรงกับปัญหา</li>
              <li>หลีกเลี่ยงการใส่รหัสผ่านหรือข้อมูลการเงิน</li>
              <li>คำขอเพิ่มโควต้าอนุมัติครั้งละ 1 บูธ</li>
            </ul>
          </InfoCard>
        </aside>
      </div>

      {(detail || detailLoading || detailError) && (
        <TicketDetailDialog
          ticket={detail}
          loading={detailLoading}
          error={detailError}
          onClose={() => {
            setDetail(null);
            setDetailError(null);
          }}
        />
      )}
    </section>
  );
}

function SupportTab({
  active,
  icon: Icon,
  title,
  description,
  onClick,
}: {
  active: boolean;
  icon: typeof Send;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`flex min-h-24 items-center gap-4 rounded-2xl border p-4 text-left transition ${
        active
          ? 'border-violet bg-violet-tint shadow-[0_12px_28px_rgba(91,44,207,0.12)]'
          : 'border-line bg-white hover:border-[#cdbcf0]'
      }`}
    >
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white text-violet shadow-sm">
        <Icon className="h-5 w-5" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <strong className="block text-base text-ink">{title}</strong>
        <small className="mt-1 block leading-5 text-muted">{description}</small>
      </span>
      <ChevronRight className="h-4 w-4 text-violet" aria-hidden />
    </button>
  );
}

function AttachmentInput({
  file,
  error,
  onChange,
}: {
  file: File | null;
  error: string | null;
  onChange: (file: File | null) => void;
}) {
  return (
    <div>
      <label className="block text-sm font-extrabold text-ink">
        ไฟล์อ้างอิง (ถ้ามี)
      </label>
      <label className="mt-2 flex min-h-24 cursor-pointer items-center justify-center gap-3 rounded-2xl border border-dashed border-[#cbb9ef] bg-[#fcfaff] px-4 py-5 text-center transition hover:border-violet hover:bg-violet-tint/40">
        <Paperclip className="h-5 w-5 text-violet" aria-hidden />
        <span>
          <strong className="block text-sm text-ink">
            {file ? file.name : 'เลือกไฟล์จากอุปกรณ์'}
          </strong>
          <small className="mt-1 block text-muted">
            JPG, PNG หรือ PDF ขนาดไม่เกิน 10 MB
          </small>
        </span>
        <input
          type="file"
          accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf"
          onChange={(event) => onChange(event.target.files?.[0] ?? null)}
          className="sr-only"
        />
      </label>
      {error ? (
        <p className="mt-2 text-sm font-semibold text-red-700">{error}</p>
      ) : null}
      {file ? (
        <button
          type="button"
          onClick={() => onChange(null)}
          className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-muted hover:text-violet"
        >
          <X className="h-3.5 w-3.5" aria-hidden /> ล้างไฟล์
        </button>
      ) : null}
    </div>
  );
}

function TrackingPanel({
  counts,
  loading,
  error,
  tickets,
  search,
  typeFilter,
  statusFilter,
  sort,
  onSearch,
  onTypeFilter,
  onStatusFilter,
  onSort,
  onOpen,
}: {
  counts: {
    total: number;
    pending: number;
    approved: number;
    rejected: number;
  };
  loading: boolean;
  error: string | null;
  tickets: VendorSupportTicket[];
  search: string;
  typeFilter: string;
  statusFilter: string;
  sort: 'NEWEST' | 'OLDEST';
  onSearch: (value: string) => void;
  onTypeFilter: (value: string) => void;
  onStatusFilter: (value: string) => void;
  onSort: (value: 'NEWEST' | 'OLDEST') => void;
  onOpen: (ticketId: string) => void;
}) {
  return (
    <div>
      <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-violet">
        Request tracking
      </p>
      <h2 className="mt-1 text-2xl font-black text-ink">รายการคำขอของฉัน</h2>
      <div className="mt-5 grid gap-3 sm:grid-cols-4">
        {[
          ['ทั้งหมด', counts.total, 'bg-violet-tint text-violet'],
          ['รอตรวจสอบ', counts.pending, 'bg-amber-50 text-amber-700'],
          ['อนุมัติ', counts.approved, 'bg-emerald-50 text-emerald-700'],
          ['ปฏิเสธ', counts.rejected, 'bg-red-50 text-red-700'],
        ].map(([label, value, tone]) => (
          <div
            key={String(label)}
            className="rounded-2xl border border-line bg-white p-4"
          >
            <span
              className={`inline-flex rounded-xl px-2.5 py-1 text-xs font-bold ${tone}`}
            >
              {label}
            </span>
            <strong className="mt-3 block text-2xl text-ink">{value}</strong>
          </div>
        ))}
      </div>
      <div className="mt-5 grid gap-3 lg:grid-cols-[minmax(0,1fr)_160px_160px_130px]">
        <label className="relative">
          <Search
            className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
            aria-hidden
          />
          <input
            type="search"
            value={search}
            onChange={(event) => onSearch(event.target.value)}
            placeholder="ค้นหาเลขคำขอ หัวข้อ หรือ Event"
            className="h-11 w-full rounded-xl border border-line bg-white pl-11 pr-4 text-sm outline-none focus:border-violet"
          />
        </label>
        <select
          value={typeFilter}
          onChange={(event) => onTypeFilter(event.target.value)}
          aria-label="กรองประเภทคำขอ"
          className="h-11 rounded-xl border border-line bg-white px-3 text-sm"
        >
          <option value="ALL">ทุกประเภท</option>
          <option value="ISSUE">แจ้งปัญหา</option>
          <option value="QUOTA">เพิ่มโควต้า</option>
        </select>
        <select
          value={statusFilter}
          onChange={(event) => onStatusFilter(event.target.value)}
          aria-label="กรองสถานะคำขอ"
          className="h-11 rounded-xl border border-line bg-white px-3 text-sm"
        >
          <option value="ALL">ทุกสถานะ</option>
          <option value="PENDING">รอตรวจสอบ</option>
          <option value="APPROVED">อนุมัติ</option>
          <option value="REJECTED">ปฏิเสธ</option>
          <option value="RESOLVED">ดำเนินการแล้ว</option>
        </select>
        <select
          value={sort}
          onChange={(event) =>
            onSort(event.target.value as 'NEWEST' | 'OLDEST')
          }
          aria-label="เรียงลำดับคำขอ"
          className="h-11 rounded-xl border border-line bg-white px-3 text-sm"
        >
          <option value="NEWEST">ล่าสุด</option>
          <option value="OLDEST">เก่าสุด</option>
        </select>
      </div>

      {loading ? (
        <p
          className="mt-6 rounded-2xl bg-[#faf8fd] p-5 text-sm text-muted"
          aria-busy="true"
        >
          กำลังโหลดรายการคำขอ...
        </p>
      ) : error ? (
        <ErrorMessage message={error} />
      ) : tickets.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-line px-6 py-12 text-center">
          <ListFilter className="mx-auto h-8 w-8 text-violet" aria-hidden />
          <p className="mt-3 font-extrabold text-ink">
            ไม่พบคำขอที่ตรงกับตัวกรอง
          </p>
          <p className="mt-1 text-sm text-muted">
            ลองเปลี่ยนคำค้นหาหรือตัวกรองสถานะ
          </p>
        </div>
      ) : (
        <div className="mt-5 grid gap-3">
          {tickets.map((item) => {
            const status = vendorTicketStatus(item);
            return (
              <article
                key={item.id}
                className="grid gap-4 rounded-2xl border border-line bg-white p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-violet-tint px-2.5 py-1 text-xs font-bold text-violet">
                      {item.type === 'OTHER' ? 'เพิ่มโควต้า' : 'แจ้งปัญหา'}
                    </span>
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-bold ${status.tone}`}
                    >
                      {status.label}
                    </span>
                  </div>
                  <h3 className="mt-3 truncate font-extrabold text-ink">
                    {item.subject}
                  </h3>
                  <p className="mt-1 text-sm text-muted">
                    {item.id} · {formatThaiDate(item.createdAt)}
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    {item.booking
                      ? `${item.booking.event.name} · Booth ${item.booking.booth.code}`
                      : (item.organization?.name ?? 'คำขอทั่วไป')}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onOpen(item.id)}
                  className="sl-action-secondary justify-center text-violet"
                >
                  ดูรายละเอียด <ChevronRight className="h-4 w-4" aria-hidden />
                </button>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

function TicketDetailDialog({
  ticket,
  loading,
  error,
  onClose,
}: {
  ticket: VendorSupportTicketDetail | null;
  loading: boolean;
  error: string | null;
  onClose: () => void;
}) {
  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[90] grid place-items-center bg-[#171126]/55 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ticket-detail-title"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="max-h-[88vh] w-full max-w-2xl overflow-y-auto rounded-[28px] bg-white p-5 shadow-2xl sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-violet">
              Request detail
            </p>
            <h2
              id="ticket-detail-title"
              className="mt-1 text-2xl font-black text-ink"
            >
              รายละเอียดคำขอ
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="ปิดรายละเอียดคำขอ"
            className="grid h-10 w-10 place-items-center rounded-full bg-[#f4f1f8] text-muted hover:text-violet"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>
        {loading ? (
          <p className="mt-6 text-sm text-muted" aria-busy="true">
            กำลังโหลดรายละเอียด...
          </p>
        ) : error ? (
          <div className="mt-6">
            <ErrorMessage message={error} />
          </div>
        ) : ticket ? (
          <div className="mt-6 grid gap-5">
            <div className="rounded-2xl bg-[#faf8fd] p-5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-violet-tint px-3 py-1 text-xs font-bold text-violet">
                  {ticket.type === 'OTHER' ? 'เพิ่มโควต้า' : 'แจ้งปัญหา'}
                </span>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-bold ${vendorTicketStatus(ticket).tone}`}
                >
                  {vendorTicketStatus(ticket).label}
                </span>
              </div>
              <h3 className="mt-4 text-lg font-black text-ink">
                {ticket.subject}
              </h3>
              <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                <DetailTerm label="เลขคำขอ" value={ticket.id} />
                <DetailTerm
                  label="วันที่ส่ง"
                  value={formatThaiDate(ticket.createdAt)}
                />
                <DetailTerm
                  label="Event"
                  value={ticket.booking?.event.name ?? '-'}
                />
                <DetailTerm
                  label="Booth"
                  value={ticket.booking?.booth.code ?? '-'}
                />
              </dl>
            </div>
            <div>
              <h3 className="font-extrabold text-ink">รายละเอียดที่ส่ง</h3>
              <div className="mt-3 grid gap-3">
                {ticket.messages.map((message) => (
                  <div
                    key={message.id}
                    className="rounded-2xl border border-line p-4"
                  >
                    <p className="whitespace-pre-wrap text-sm leading-7 text-ink">
                      {message.message}
                    </p>
                    <p className="mt-2 text-xs text-muted">
                      {message.sender.fullName} ·{' '}
                      {formatThaiDate(message.createdAt)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function DetailTerm({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-bold text-muted">{label}</dt>
      <dd className="mt-1 break-words font-extrabold text-ink">{value}</dd>
    </div>
  );
}

function InfoCard({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof Info;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="sl-surface p-5">
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-2xl bg-violet-tint text-violet">
          <Icon className="h-5 w-5" aria-hidden />
        </span>
        <h2 className="font-black text-ink">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function OrganizationAdminTicketForm({ token }: { token: string }) {
  const { organizations, selectedOrganizationId } =
    useAdminOrganizationSelection();
  const [subject, setSubject] = useState('ขอความช่วยเหลือจาก Super Admin');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ticket, setTicket] = useState<SupportTicketRecord | null>(null);
  const organization = organizations.find(
    (item) => item.id === selectedOrganizationId,
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedOrganizationId) {
      setError('กรุณาเลือกองค์กรก่อนส่งคำร้อง');
      return;
    }
    if (!subject.trim() || !message.trim()) {
      setError('กรุณากรอกหัวข้อและรายละเอียดให้ครบ');
      return;
    }

    setSubmitting(true);
    setError(null);
    setTicket(null);
    try {
      const created = await createOrganizationAdminSupportTicket(
        selectedOrganizationId,
        { subject, message },
        token,
      );
      setTicket(created);
      setMessage('');
    } catch (cause) {
      setError(describeError(cause, 'ส่งคำร้องถึง Super Admin ไม่สำเร็จ'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section
      aria-labelledby="organization-admin-request-heading"
      className="sl-surface mt-8 p-6 sm:p-8"
    >
      <div className="flex items-start gap-4">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-violet-tint text-violet">
          <Send className="h-5 w-5" aria-hidden />
        </span>
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-violet">
            Organization support
          </p>
          <h2
            id="organization-admin-request-heading"
            className="mt-1 text-2xl font-black text-ink"
          >
            ส่งคำร้องถึง Super Admin
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted">
            ส่งปัญหาหรือคำขอเกี่ยวกับองค์กรให้ผู้ดูแลแพลตฟอร์มตรวจสอบ
          </p>
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-[#ded5eb] bg-violet-tint/50 p-4">
        <p className="text-xs font-bold text-muted">องค์กรที่ส่งคำร้อง</p>
        <p className="mt-1 font-extrabold text-ink">
          {organization?.name ?? 'ยังไม่ได้เลือกองค์กร'}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="mt-5 grid gap-4">
        <Field label="หัวข้อคำร้อง">
          <input
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
            className={inputClass}
            maxLength={200}
            required
          />
        </Field>
        <Field label="รายละเอียด">
          <textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            className={`${inputClass} min-h-32 py-3`}
            placeholder="อธิบายปัญหา สิ่งที่ต้องการให้ช่วย และข้อมูลที่เกี่ยวข้อง"
            maxLength={2000}
            required
          />
        </Field>

        {error ? <ErrorMessage message={error} /> : null}
        {ticket ? (
          <SuccessMessage>
            ส่งคำร้องเรียบร้อยแล้ว เลขคำร้อง {ticket.id}
          </SuccessMessage>
        ) : null}

        <button
          type="submit"
          disabled={submitting || !selectedOrganizationId}
          className="sl-action-primary justify-center disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Send className="h-4 w-4" aria-hidden />
          {submitting ? 'กำลังส่งคำร้อง...' : 'ส่งคำร้องถึง Super Admin'}
        </button>
      </form>
    </section>
  );
}

/**
 * SCRUM-182 removed the hand-typed approval form that used to live here. It
 * asked for a Ticket ID, an Event ID and a Booth ID as free text, with no list
 * to pick from — and approving a quota request no longer creates a booking at
 * all, so there is no booth for anyone to type. Requests are reviewed on the
 * organization inbox at /admin/quota-requests; Super Admin support lives in its
 * own console.
 */
function SuperAdminSupportPointer() {
  return (
    <section
      aria-labelledby="support-console-heading"
      className="sl-surface mt-8 p-6 sm:p-8"
    >
      <div className="flex items-start gap-4">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-violet-tint text-violet">
          <ShieldCheck className="h-5 w-5" aria-hidden />
        </span>
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-violet">
            Support
          </p>
          <h2
            id="support-console-heading"
            className="mt-1 text-2xl font-black text-ink"
          >
            จัดการคำร้องได้ที่หน้าเฉพาะ
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted">
            คำร้องขอเพิ่มโควตาของแต่ละองค์กรอยู่ที่หน้า
            &ldquo;คำร้องขอเพิ่มโควตาบูธ&rdquo; ในเมนูผู้ดูแลองค์กร
            ส่วนคำร้องทั้งระบบอยู่ในคอนโซล Super Admin
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              href="/admin/quota-requests"
              className="sl-action-primary w-fit"
            >
              <ClipboardCheck className="h-4 w-4" aria-hidden />
              ไปที่คำร้องขอเพิ่มโควตา
            </Link>
            <Link
              href="/super-admin/support"
              className="sl-action-secondary w-fit"
            >
              คำร้องทั้งระบบ
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block text-sm font-extrabold text-ink">
      {label}
      {children}
    </label>
  );
}

function ErrorMessage({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="flex items-start gap-2 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
    >
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <span>{message}</span>
    </div>
  );
}

function SuccessMessage({ children }: { children: ReactNode }) {
  return (
    <div
      role="status"
      className="flex items-start gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800"
    >
      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <span>{children}</span>
    </div>
  );
}

function bookingStatusLabel(status: MyBooking['status']): string {
  const labels: Record<MyBooking['status'], string> = {
    PENDING_PAYMENT: 'รอชำระเงิน',
    CONFIRMED: 'ยืนยันแล้ว',
    CANCELLED: 'ยกเลิกแล้ว',
    NO_SHOW: 'ไม่เข้าร่วมงาน',
    COMPLETED: 'เสร็จสิ้น',
  };
  return labels[status];
}

function formatBoothSize(booth: QuotaBoothOption): string {
  return booth.widthM && booth.heightM
    ? `${booth.widthM} × ${booth.heightM} เมตร`
    : 'ไม่ระบุขนาด';
}

function issueKindLabel(kind: IssueKind): string {
  return {
    PAYMENT: 'การชำระเงิน',
    BOOKING: 'การจองบูธ',
    UPLOAD: 'การอัปโหลดไฟล์',
    ACCOUNT: 'บัญชีและร้านค้า',
    OTHER: 'อื่น ๆ',
  }[kind];
}

function issuePriorityLabel(priority: IssuePriority): string {
  return priority === 'URGENT' ? 'เร่งด่วน' : 'ปกติ';
}

function vendorTicketStatus(ticket: VendorSupportTicket): {
  key: 'PENDING' | 'APPROVED' | 'REJECTED' | 'RESOLVED';
  label: string;
  tone: string;
} {
  if (ticket.status !== 'CLOSED') {
    return {
      key: 'PENDING',
      label: ticket.status === 'PROCESSING' ? 'กำลังดำเนินการ' : 'รอตรวจสอบ',
      tone: 'bg-amber-50 text-amber-700',
    };
  }
  if (ticket.type === 'OTHER') {
    return ticket.quotaGrant
      ? {
          key: 'APPROVED',
          label: 'อนุมัติ',
          tone: 'bg-emerald-50 text-emerald-700',
        }
      : {
          key: 'REJECTED',
          label: 'ปฏิเสธ',
          tone: 'bg-red-50 text-red-700',
        };
  }
  return {
    key: 'RESOLVED',
    label: 'ดำเนินการแล้ว',
    tone: 'bg-blue-50 text-blue-700',
  };
}

function formatThaiDate(value: string): string {
  return new Intl.DateTimeFormat('th-TH', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Bangkok',
  }).format(new Date(value));
}

function describeError(cause: unknown, fallback: string): string {
  if (cause instanceof ApiError) return cause.message;
  return fallback;
}
