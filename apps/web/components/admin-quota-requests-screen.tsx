'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Inbox,
  Loader2,
  MessageSquareText,
  RefreshCw,
  XCircle,
} from 'lucide-react';
import {
  AdminAccessGate,
  AdminEmpty,
  AdminError,
  AdminMetric,
  AdminPage,
  AdminPageHeader,
  AdminPanel,
  formatAdminDateTime,
  useAdminPageAccess,
} from '@/components/admin-ui';
import {
  approveQuotaException,
  getOrganizationSupportTicketDetail,
  getOrganizationSupportTickets,
  rejectQuotaException,
  type OrganizationSupportTicket,
  type OrganizationSupportTicketDetail,
  type SupportTicketStatus,
} from '@/lib/api';

const STATUS_LABELS: Record<SupportTicketStatus, string> = {
  OPEN: 'เปิดอยู่',
  PROCESSING: 'กำลังดำเนินการ',
  CLOSED: 'ปิดแล้ว',
};

const STATUS_TONES: Record<SupportTicketStatus, string> = {
  OPEN: 'bg-[#fff4df] text-[#9a570f]',
  PROCESSING: 'bg-[#e7f0ff] text-[#28508f]',
  CLOSED: 'bg-[#eef0f3] text-[#5e6773]',
};

/** A quota request is a TicketType.OTHER ticket; everything else is a report. */
const QUOTA_TICKET_TYPE = 'OTHER';

type Filter = 'ACTIONABLE' | 'ALL';

export function AdminQuotaRequestsScreen() {
  const { access, token, organizationId, organization } = useAdminPageAccess();
  const [tickets, setTickets] = useState<OrganizationSupportTicket[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [filter, setFilter] = useState<Filter>('ACTIONABLE');
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);

  useEffect(() => {
    if (access !== 'allowed' || !token || !organizationId) return;
    const controller = new AbortController();
    let active = true;
    setLoading(true);
    setError('');

    void (async () => {
      try {
        const rows = await getOrganizationSupportTickets(
          organizationId,
          token,
          controller.signal,
        );
        if (!active) return;
        setTickets(rows);
      } catch (cause) {
        if (cause instanceof DOMException && cause.name === 'AbortError') return;
        if (active) {
          setTickets([]);
          setError(
            cause instanceof Error ? cause.message : 'โหลดคำร้องไม่สำเร็จ',
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
      controller.abort();
    };
  }, [access, organizationId, reloadKey, token]);

  const quotaTickets = useMemo(
    () => tickets.filter((ticket) => ticket.type === QUOTA_TICKET_TYPE),
    [tickets],
  );
  const visibleTickets = useMemo(
    () =>
      filter === 'ALL'
        ? quotaTickets
        : quotaTickets.filter((ticket) => ticket.status !== 'CLOSED'),
    [filter, quotaTickets],
  );
  const openCount = quotaTickets.filter(
    (ticket) => ticket.status === 'OPEN',
  ).length;
  const processingCount = quotaTickets.filter(
    (ticket) => ticket.status === 'PROCESSING',
  ).length;

  function reload() {
    setSelectedTicketId(null);
    setReloadKey((value) => value + 1);
  }

  return (
    <AdminAccessGate access={access}>
      <AdminPage>
        <AdminPageHeader
          eyebrow="Quota requests"
          title="คำร้องขอเพิ่มโควตาบูธ"
          description="ตรวจสอบคำร้องขอเพิ่มโควตาจากผู้ขายในองค์กรของคุณ การอนุมัติจะให้สิทธิ์จองเพิ่ม 1 บูธ ผู้ขายต้องกลับไปเลือกบูธที่ว่างด้วยตนเอง"
          organizationName={organization?.name}
          actions={
            <button
              type="button"
              onClick={reload}
              disabled={loading}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#ddd4e7] bg-white px-4 text-xs font-extrabold text-[#655d70] disabled:opacity-50"
            >
              <RefreshCw
                className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`}
                aria-hidden
              />
              โหลดใหม่
            </button>
          }
        />

        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <AdminMetric icon={Inbox} label="รอตรวจสอบ" value={openCount} tone="amber" />
          <AdminMetric
            icon={Loader2}
            label="กำลังดำเนินการ"
            value={processingCount}
            tone="blue"
          />
          <AdminMetric
            icon={MessageSquareText}
            label="คำร้องทั้งหมด"
            value={quotaTickets.length}
          />
        </div>

        {error ? (
          <div className="mt-6">
            <AdminError message={error} />
          </div>
        ) : null}

        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
          <AdminPanel
            title="รายการคำร้อง"
            description="เลือกคำร้องเพื่อดูรายละเอียดและตัดสินใจ"
            actions={
              <div className="inline-flex rounded-xl border border-[#ddd4e7] bg-white p-1">
                {(['ACTIONABLE', 'ALL'] as Filter[]).map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setFilter(item)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-extrabold ${
                      filter === item
                        ? 'bg-violet text-white'
                        : 'text-[#655d70]'
                    }`}
                  >
                    {item === 'ACTIONABLE' ? 'ที่ต้องดำเนินการ' : 'ทั้งหมด'}
                  </button>
                ))}
              </div>
            }
          >
            {loading ? (
              <div className="space-y-3 p-5">
                <div className="skeleton h-16 rounded-2xl" />
                <div className="skeleton h-16 rounded-2xl" />
                <div className="skeleton h-16 rounded-2xl" />
              </div>
            ) : visibleTickets.length === 0 ? (
              <AdminEmpty
                icon={Inbox}
                title="ยังไม่มีคำร้อง"
                description="เมื่อผู้ขายส่งคำร้องขอเพิ่มโควตา คำร้องจะปรากฏที่นี่และคุณจะได้รับการแจ้งเตือน"
              />
            ) : (
              <ul className="divide-y divide-[#eee9f3]">
                {visibleTickets.map((ticket) => (
                  <li key={ticket.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedTicketId(ticket.id)}
                      className={`flex w-full items-start justify-between gap-4 px-5 py-4 text-left transition ${
                        selectedTicketId === ticket.id
                          ? 'bg-[#f6f1ff]'
                          : 'hover:bg-[#faf8fd]'
                      }`}
                    >
                      <div className="min-w-0">
                        <p className="truncate font-extrabold text-ink">
                          {ticket.subject}
                        </p>
                        <p className="mt-1 truncate text-xs text-muted">
                          {ticket.user.fullName} · {ticket.user.email}
                        </p>
                        <p className="mt-1 text-xs text-muted">
                          {formatAdminDateTime(ticket.createdAt)}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-3 py-1 text-xs font-black ${
                          STATUS_TONES[ticket.status]
                        }`}
                      >
                        {STATUS_LABELS[ticket.status]}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </AdminPanel>

          {selectedTicketId ? (
            <TicketDecisionPanel
              key={selectedTicketId}
              ticketId={selectedTicketId}
              organizationId={organizationId}
              token={token}
              onDecided={reload}
            />
          ) : (
            <AdminPanel title="รายละเอียดคำร้อง">
              <AdminEmpty
                icon={MessageSquareText}
                title="ยังไม่ได้เลือกคำร้อง"
                description="เลือกคำร้องจากรายการทางซ้ายเพื่อดูรายละเอียดและอนุมัติหรือปฏิเสธ"
              />
            </AdminPanel>
          )}
        </div>
      </AdminPage>
    </AdminAccessGate>
  );
}

function TicketDecisionPanel({
  ticketId,
  organizationId,
  token,
  onDecided,
}: {
  ticketId: string;
  organizationId: string;
  token: string;
  onDecided: () => void;
}) {
  const [detail, setDetail] = useState<OrganizationSupportTicketDetail | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reason, setReason] = useState('');
  const [actionError, setActionError] = useState('');
  const [success, setSuccess] = useState('');
  const [pending, setPending] = useState<'approve' | 'reject' | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setLoading(true);
    setError('');

    void (async () => {
      try {
        const row = await getOrganizationSupportTicketDetail(
          organizationId,
          ticketId,
          token,
          controller.signal,
        );
        if (!active) return;
        setDetail(row);
      } catch (cause) {
        if (cause instanceof DOMException && cause.name === 'AbortError') return;
        if (active) {
          setDetail(null);
          setError(
            cause instanceof Error
              ? cause.message
              : 'โหลดรายละเอียดคำร้องไม่สำเร็จ',
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
      controller.abort();
    };
  }, [organizationId, ticketId, token]);

  const closed = detail?.status === 'CLOSED';

  async function approve() {
    setActionError('');
    setSuccess('');
    setPending('approve');
    try {
      await approveQuotaException(ticketId, { reason }, token);
      setSuccess(
        'อนุมัติแล้ว ผู้ขายได้รับสิทธิ์จองเพิ่ม 1 บูธ และต้องกลับไปเลือกบูธด้วยตนเอง',
      );
      onDecided();
    } catch (cause) {
      setActionError(
        cause instanceof Error ? cause.message : 'อนุมัติคำร้องไม่สำเร็จ',
      );
    } finally {
      setPending(null);
    }
  }

  async function reject() {
    if (!reason.trim()) {
      setActionError('กรุณาระบุเหตุผลในการปฏิเสธ');
      return;
    }
    setActionError('');
    setSuccess('');
    setPending('reject');
    try {
      await rejectQuotaException(ticketId, { reason }, token);
      setSuccess('ปฏิเสธคำร้องแล้ว ระบบแจ้งเหตุผลให้ผู้ขายทราบเรียบร้อย');
      onDecided();
    } catch (cause) {
      setActionError(
        cause instanceof Error ? cause.message : 'ปฏิเสธคำร้องไม่สำเร็จ',
      );
    } finally {
      setPending(null);
    }
  }

  return (
    <AdminPanel title="รายละเอียดคำร้อง">
      {loading ? (
        <div className="space-y-3 p-5">
          <div className="skeleton h-6 w-2/3 rounded-lg" />
          <div className="skeleton h-32 rounded-2xl" />
        </div>
      ) : error ? (
        <div className="p-5">
          <AdminError message={error} />
        </div>
      ) : !detail ? (
        <AdminEmpty
          icon={MessageSquareText}
          title="ไม่พบคำร้อง"
          description="คำร้องนี้อาจถูกลบไปแล้ว หรือไม่ได้อยู่ในองค์กรของคุณ"
        />
      ) : (
        <div className="space-y-5 p-5">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-lg font-black text-ink">{detail.subject}</h3>
              <span
                className={`rounded-full px-3 py-1 text-xs font-black ${
                  STATUS_TONES[detail.status]
                }`}
              >
                {STATUS_LABELS[detail.status]}
              </span>
            </div>
            <p className="mt-2 text-xs text-muted">
              {detail.user.fullName} · {detail.user.email}
            </p>
            <p className="mt-1 text-xs text-muted">
              ส่งเมื่อ {formatAdminDateTime(detail.createdAt)}
            </p>
          </div>

          {detail.booking ? (
            <div className="rounded-[16px] border border-[#e6ddf2] bg-[#faf8fd] px-4 py-3 text-sm leading-6 text-[#4b4356]">
              <p className="font-extrabold text-ink">
                งาน: {detail.booking.event.name}
              </p>
              <p className="mt-1 text-xs">
                การจองอ้างอิง: {detail.booking.bookingCode} · บูธ{' '}
                {detail.booking.booth.code}
              </p>
            </div>
          ) : (
            <div className="rounded-[16px] border border-[#f3d9d9] bg-[#fdf3f3] px-4 py-3 text-sm leading-6 text-[#8a3d3d]">
              คำร้องนี้ไม่มีข้อมูลงานที่เกี่ยวข้อง จึงไม่สามารถอนุมัติได้
              กรุณาให้ผู้ขายส่งคำร้องใหม่
            </div>
          )}

          <div>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-violet">
              ข้อความจากผู้ขาย
            </p>
            <ul className="mt-3 space-y-3">
              {detail.messages.map((message) => (
                <li
                  key={message.id}
                  className="rounded-[16px] border border-[#eee9f3] bg-white px-4 py-3"
                >
                  <p className="whitespace-pre-line text-sm leading-6 text-[#4b4356]">
                    {message.message}
                  </p>
                  <p className="mt-2 text-[11px] text-muted">
                    {message.sender.fullName} ·{' '}
                    {formatAdminDateTime(message.createdAt)}
                  </p>
                </li>
              ))}
            </ul>
          </div>

          {closed ? (
            <div className="rounded-[16px] border border-[#e3e6ea] bg-[#f4f6f8] px-4 py-3 text-sm leading-6 text-[#5e6773]">
              คำร้องนี้ถูกปิดแล้ว ไม่สามารถอนุมัติหรือปฏิเสธซ้ำได้
            </div>
          ) : (
            <div className="space-y-3">
              <label className="block">
                <span className="text-xs font-black uppercase tracking-[0.14em] text-violet">
                  เหตุผล
                </span>
                <textarea
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  rows={3}
                  maxLength={500}
                  placeholder="ระบุเหตุผล (จำเป็นเมื่อปฏิเสธ ผู้ขายจะเห็นข้อความนี้)"
                  className="mt-2 w-full rounded-[14px] border border-[#ddd4e7] bg-white px-4 py-3 text-sm leading-6 text-ink outline-none focus:border-violet"
                />
              </label>

              {actionError ? <AdminError message={actionError} /> : null}
              {success ? (
                <div className="rounded-[16px] border border-[#cfe9d6] bg-[#f2fbf5] px-4 py-3 text-sm leading-6 text-[#256b3c]">
                  {success}
                </div>
              ) : null}

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={approve}
                  disabled={pending !== null || !detail.booking}
                  className="inline-flex h-11 items-center gap-2 rounded-xl bg-violet px-5 text-sm font-extrabold text-white disabled:opacity-50"
                >
                  <CheckCircle2 className="h-4 w-4" aria-hidden />
                  {pending === 'approve' ? 'กำลังอนุมัติ…' : 'อนุมัติคำร้อง'}
                </button>
                <button
                  type="button"
                  onClick={reject}
                  disabled={pending !== null}
                  className="inline-flex h-11 items-center gap-2 rounded-xl border border-[#e3c9c9] bg-white px-5 text-sm font-extrabold text-[#a34a4a] disabled:opacity-50"
                >
                  <XCircle className="h-4 w-4" aria-hidden />
                  {pending === 'reject' ? 'กำลังปฏิเสธ…' : 'ปฏิเสธคำร้อง'}
                </button>
              </div>

              <p className="text-xs leading-5 text-muted">
                การอนุมัติจะให้สิทธิ์จองเพิ่ม 1
                บูธเท่านั้น ระบบจะไม่จองบูธให้ผู้ขายโดยอัตโนมัติ
                และสิทธิ์นี้ใช้ได้จนกว่างานจะปิดรับจอง
              </p>
            </div>
          )}
        </div>
      )}
    </AdminPanel>
  );
}
