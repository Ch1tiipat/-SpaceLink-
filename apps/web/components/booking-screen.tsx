'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { BookingCountdown } from '@/components/booking-countdown';
import { SlipUploadPanel } from '@/components/slip-upload-panel';
import { ZoneMap } from '@/components/zone-map';
import { SelectMenu } from '@/components/select-menu';
import {
  createBooking,
  getEventMap,
  getMyBookings,
  type BookingRecord,
  type EventBooth,
  type EventMap,
} from '@/lib/api';
import { useVendorProfile } from '@/lib/use-vendor-profile';

const HOLD_STATUS_REFRESH_ATTEMPTS = 13;
const HOLD_STATUS_REFRESH_INTERVAL_MS = 5_000;

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

function formatMoney(value: string): string {
  const [whole, fraction] = value.split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return fraction && !/^0+$/.test(fraction) ? `${grouped}.${fraction}` : grouped;
}

export function BookingScreen({ eventId }: { eventId: string }) {
  const { state: vendor } = useVendorProfile();
  const [data, setData] = useState<EventMap | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [focusedZoneId, setFocusedZoneId] = useState<string | null>(null);
  const [selectedBooth, setSelectedBooth] = useState<EventBooth | null>(null);
  const [createdBooking, setCreatedBooking] = useState<BookingRecord | null>(
    null,
  );
  const [holdExpired, setHoldExpired] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    getEventMap(eventId, controller.signal)
      .then(setData)
      .catch((cause: unknown) => {
        if (cause instanceof DOMException && cause.name === 'AbortError') return;
        setLoadError(
          cause instanceof Error ? cause.message : 'โหลดข้อมูล Event ไม่สำเร็จ',
        );
      });
    return () => controller.abort();
  }, [eventId]);

  const selectedZone = useMemo(
    () =>
      data?.zones.find((zone) =>
        zone.booths.some((booth) => booth.id === selectedBooth?.id),
      ) ?? null,
    [data, selectedBooth],
  );
  // A vendor owns one shop at most, so there is nothing to pick: the booking
  // uses the shop the account already has, or it cannot be made at all.
  const shop = vendor.status === 'ready' ? vendor.shop : null;

  async function handleCreate() {
    if (vendor.status !== 'ready' || !vendor.shop || !selectedBooth) {
      return;
    }

    setIsCreating(true);
    setActionError(null);
    try {
      const booking = await createBooking(
        { eventId, boothId: selectedBooth.id, shopId: vendor.shop.id },
        vendor.token,
      );
      setCreatedBooking(booking);
      setHoldExpired(false);
    } catch (cause) {
      setActionError(
        cause instanceof Error ? cause.message : 'สร้างการจองไม่สำเร็จ',
      );
    } finally {
      setIsCreating(false);
    }
  }

  async function handleHoldExpired() {
    setHoldExpired(true);
    if (vendor.status !== 'ready' || !createdBooking) return;

    for (let attempt = 0; attempt < HOLD_STATUS_REFRESH_ATTEMPTS; attempt += 1) {
      try {
        const bookings = await getMyBookings(vendor.token);
        const refreshed = bookings.find(
          (booking) => booking.id === createdBooking.id,
        );
        if (!refreshed) return;

        setCreatedBooking(refreshed);
        if (refreshed.status !== 'PENDING_PAYMENT') return;
      } catch {
        // Keep upload disabled once the client-side hold has expired. A later
        // visit to My Bookings will fetch the server status again.
        return;
      }

      if (attempt < HOLD_STATUS_REFRESH_ATTEMPTS - 1) {
        await wait(HOLD_STATUS_REFRESH_INTERVAL_MS);
      }
    }
  }

  if (!data && !loadError) {
    return (
      <main>
        <div className="shell py-10">
          <div className="skeleton h-24 rounded-3xl" />
          <div className="skeleton mt-6 h-[620px] rounded-3xl" />
        </div>
      </main>
    );
  }

  if (!data || loadError) {
    return (
      <main>
        <div className="shell py-20 text-center">
          <h1 className="text-2xl font-bold">เปิดหน้าจองบูธไม่ได้</h1>
          <p className="mt-3 text-muted">{loadError ?? 'ไม่พบข้อมูล Event'}</p>
          <Link href={`/events/${eventId}`} className="mt-7 inline-flex rounded-xl bg-violet px-5 py-3 font-bold text-white">
            กลับหน้ารายละเอียด Event
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="pb-16">
      <div className="shell py-8">
        <Link href={`/events/${eventId}`} className="text-sm font-bold text-violet">
          ← กลับหน้ารายละเอียด Event
        </Link>

        <div className="mt-5 flex flex-col gap-2">
          <span className="text-xs font-bold uppercase tracking-[.14em] text-violet">
            Booking
          </span>
          <h1 className="text-3xl font-bold tracking-[-0.04em] sm:text-4xl">
            จองบูธใน {data.event.name}
          </h1>
          <p className="text-muted">
            เลือกโซน บูธ และร้านค้าที่จะเข้าร่วม ก่อนยืนยันการจอง
          </p>
        </div>

        {createdBooking ? (
          <section className="mt-7 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
            <div className="rounded-[28px] border border-line bg-white p-6 shadow-soft sm:p-8">
              <span className="inline-flex rounded-full bg-[#eee8ff] px-3 py-1 text-xs font-bold text-violet">
                {createdBooking.status}
              </span>
              <h2 className="mt-4 text-2xl font-bold">สร้างการจองสำเร็จ</h2>
              <p className="mt-2 text-muted">
                รหัสการจอง <strong className="text-ink">{createdBooking.bookingCode}</strong>
              </p>
              <dl className="mt-6 divide-y divide-line text-sm">
                <SummaryRow label="Event" value={data.event.name} />
                <SummaryRow
                  label="บูธ / โซน"
                  value={`${selectedBooth?.code ?? createdBooking.boothId} / ${selectedZone?.name ?? selectedZone?.code ?? '-'}`}
                />
                <SummaryRow label="ร้านค้า" value={shop?.name ?? '-'} />
                <SummaryRow
                  label="ราคา"
                  value={`${formatMoney(createdBooking.boothPrice)} บาท`}
                />
              </dl>

              <div className="mt-6 rounded-2xl bg-mist p-4 text-sm">
                {createdBooking.status === 'PENDING_PAYMENT' ? (
                  <BookingCountdown
                    expiresAt={createdBooking.holdExpiresAt}
                    active
                    onExpired={() => void handleHoldExpired()}
                  />
                ) : createdBooking.status === 'CONFIRMED' ? (
                  <span className="font-bold text-[#16775b]">ยืนยันการจองแล้ว</span>
                ) : createdBooking.status === 'CANCELLED' ? (
                  <span className="font-bold text-[#b42318]">การจองถูกยกเลิกแล้ว</span>
                ) : createdBooking.status === 'COMPLETED' ? (
                  <span className="font-bold text-[#16775b]">การจองเสร็จสิ้นแล้ว</span>
                ) : (
                  <span className="font-bold text-muted">ไม่ได้เข้าร่วม Event</span>
                )}
              </div>

              <Link href="/bookings" className="mt-6 inline-flex rounded-xl border border-violet px-5 py-3 font-bold text-violet">
                ไปที่การจองของฉัน
              </Link>
            </div>

            {vendor.status === 'ready' &&
              createdBooking.status === 'PENDING_PAYMENT' && (
                <SlipUploadPanel
                  bookingId={createdBooking.id}
                  token={vendor.token}
                  disabled={holdExpired}
                  onConfirmed={(response) =>
                    setCreatedBooking((current) =>
                      current
                        ? {
                            ...current,
                            status: response.booking.status,
                            confirmedAt: response.booking.confirmedAt,
                          }
                        : current,
                    )
                  }
                />
              )}
          </section>
        ) : (
          <div className="mt-7 grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
            <section className="glass min-w-0 rounded-[28px] p-4 shadow-soft sm:p-6">
              <SelectMenu
                className="max-w-sm"
                label="เลือกโซน"
                placeholder="ดูพื้นที่ทั้งหมด"
                value={focusedZoneId ?? ''}
                onChange={(value) => {
                  setFocusedZoneId(value || null);
                  setSelectedBooth(null);
                }}
                options={[
                  { value: '', label: 'ดูพื้นที่ทั้งหมด' },
                  ...data.zones.map((zone) => ({
                    value: zone.id,
                    label: `${zone.code} — ${zone.name ?? 'ไม่ระบุชื่อโซน'}`,
                  })),
                ]}
              />

              <div className="mt-5">
                <ZoneMap
                  mapImageUrl={data.event.mapImageUrl}
                  zones={data.zones}
                  focusedZoneId={focusedZoneId}
                  selectedBoothId={selectedBooth?.id ?? null}
                  recommendedBoothId={null}
                  onFocusZone={(zoneId) => {
                    setFocusedZoneId(zoneId);
                    setSelectedBooth(null);
                  }}
                  onSelectBooth={setSelectedBooth}
                />
              </div>
            </section>

            <aside className="sticky top-[96px] rounded-[28px] border border-line bg-white p-6 shadow-soft">
              <span className="text-xs font-bold uppercase tracking-[.13em] text-violet">
                Booking summary
              </span>
              <h2 className="mt-2 text-xl font-bold">
                {selectedBooth ? `บูธ ${selectedBooth.code}` : 'ยังไม่ได้เลือกบูธ'}
              </h2>
              {selectedBooth && (
                <p className="mt-2 text-sm text-muted">
                  {selectedZone?.name ?? `โซน ${selectedZone?.code ?? '-'}`} ·{' '}
                  {formatMoney(selectedBooth.boothPrice)} บาท
                </p>
              )}

              <div className="mt-6 border-t border-line pt-5">
                {vendor.status === 'loading' && (
                  <p className="text-sm text-muted">กำลังตรวจสอบบัญชีผู้ขาย…</p>
                )}
                {vendor.status === 'signed-out' && (
                  <p className="text-sm text-muted">
                    กรุณา <Link href="/login" className="font-bold text-violet">เข้าสู่ระบบ</Link> ก่อนจองบูธ
                  </p>
                )}
                {vendor.status === 'error' && (
                  <p className="text-sm text-[#b42318]">{vendor.message}</p>
                )}
                {vendor.status === 'ready' && !shop && (
                  <p className="text-sm">
                    <Link href="/profile" className="font-bold text-violet underline">
                      บัญชีนี้ยังไม่มีร้านค้า จึงยังไม่สามารถสร้างการจองได้
                    </Link>
                  </p>
                )}
                {vendor.status === 'ready' && shop && (
                  <div>
                    <span className="block text-[10px] font-bold uppercase tracking-[.12em] text-muted">
                      ร้านค้าที่เข้าร่วม
                    </span>
                    <b className="mt-1.5 block text-sm">{shop.name}</b>
                  </div>
                )}
              </div>

              {actionError && (
                <p role="alert" className="mt-4 rounded-xl bg-[#fff0ee] px-4 py-3 text-sm text-[#b42318]">
                  {actionError}
                </p>
              )}

              <button
                type="button"
                onClick={() => void handleCreate()}
                disabled={
                  isCreating ||
                  !selectedBooth ||
                  !shop ||
                  vendor.status !== 'ready'
                }
                className="mt-6 w-full rounded-xl bg-violet px-5 py-3 font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isCreating ? 'กำลังสร้างการจอง…' : 'ยืนยันการจองบูธ'}
              </button>
            </aside>
          </div>
        )}
      </div>
    </main>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 py-4">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right font-bold">{value}</dd>
    </div>
  );
}
