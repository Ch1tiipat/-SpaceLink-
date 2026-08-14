'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type ChangeEvent, useEffect, useMemo, useState } from 'react';
import {
  Building2,
  Landmark,
  MapPin,
  QrCode,
  ShieldCheck,
} from 'lucide-react';
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
  type EventZone,
} from '@/lib/api';
import { useVendorProfile } from '@/lib/use-vendor-profile';
import { canUseUxPreview } from '@/lib/ux-preview';

const HOLD_STATUS_REFRESH_ATTEMPTS = 13;
const HOLD_STATUS_REFRESH_INTERVAL_MS = 5_000;

type PaymentMethod = 'qr' | 'bank';

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

function formatMoney(value: string): string {
  const [whole, fraction] = value.split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return fraction && !/^0+$/.test(fraction) ? `${grouped}.${fraction}` : grouped;
}

export function BookingScreen({ eventId }: { eventId: string }) {
  const router = useRouter();
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
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('qr');

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
      const now = new Date();
      const booking: BookingRecord = canUseUxPreview()
        ? {
            id: 'local-preview-booking',
            bookingCode: 'SL-DEMO-2569',
            eventId,
            boothId: selectedBooth.id,
            shopId: vendor.shop.id,
            vendorUserId: vendor.profile.id,
            bookingStartDate: data?.event.startDate ?? now.toISOString(),
            bookingEndDate: data?.event.endDate ?? now.toISOString(),
            boothPrice: selectedBooth.boothPrice,
            isPaymentExempt: false,
            paymentExemptReason: null,
            status: 'PENDING_PAYMENT',
            holdExpiresAt: new Date(now.getTime() + 15 * 60 * 1000).toISOString(),
            confirmedAt: null,
            cancelReason: null,
            cancelledAt: null,
            createdAt: now.toISOString(),
            updatedAt: now.toISOString(),
          }
        : await createBooking(
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
    if (canUseUxPreview()) return;

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
    <main className="sl-page pb-16">
      <div className="shell py-8">
        <Link href={`/events/${eventId}`} className="sl-chip">
          ← กลับหน้ารายละเอียด Event
        </Link>

        <div className="mt-6 flex flex-col gap-2">
          <span className="sl-kicker">
            Booking
          </span>
          <h1 className="text-3xl font-black tracking-[-0.045em] sm:text-4xl">
            จองบูธใน {data.event.name}
          </h1>
          <p className="text-muted">
            เลือกโซน บูธ และร้านค้าที่จะเข้าร่วม ก่อนยืนยันการจอง
          </p>
        </div>

        {!createdBooking ? (
          <ol className="mt-6 grid gap-2 rounded-[22px] border border-[#e6def3] bg-white/85 p-2 shadow-sm sm:grid-cols-3">
            {[
              ['1', 'เลือกโซนและบูธ'],
              ['2', 'ตรวจสอบร้านและราคา'],
              ['3', 'ยืนยันและชำระเงิน'],
            ].map(([number, label], index) => (
              <li
                key={number}
                className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-bold ${
                  index === 0 ? 'bg-violet-tint text-violet' : 'text-muted'
                }`}
              >
                <span
                  className={`grid h-7 w-7 place-items-center rounded-full text-xs ${
                    index === 0 ? 'bg-violet text-white' : 'bg-[#f1eef5] text-muted'
                  }`}
                >
                  {number}
                </span>
                {label}
              </li>
            ))}
          </ol>
        ) : null}

        {createdBooking ? (
          <section className="mt-7 grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
            <PaymentSummary
              booking={createdBooking}
              event={data}
              booth={selectedBooth}
              zoneName={selectedZone?.name ?? selectedZone?.code ?? '-'}
              shopName={shop?.name ?? '-'}
              holdExpired={holdExpired}
              onExpired={() => void handleHoldExpired()}
              onChooseAgain={() => {
                setCreatedBooking(null);
                setHoldExpired(false);
                setSelectedBooth(null);
              }}
            />

            <div className="grid gap-5">
              {canUseUxPreview() ? (
                <PaymentMethodPanel
                  method={paymentMethod}
                  onChange={setPaymentMethod}
                  amount={createdBooking.boothPrice}
                  disabled={holdExpired}
                />
              ) : null}

              {vendor.status === 'ready' &&
                createdBooking.status === 'PENDING_PAYMENT' && (
                  canUseUxPreview() ? (
                    <PreviewSlipUploadPanel
                      disabled={holdExpired}
                      onConfirmed={() =>
                        setCreatedBooking((current) =>
                          current
                            ? {
                                ...current,
                                status: 'CONFIRMED',
                                confirmedAt: new Date().toISOString(),
                              }
                            : current,
                        )
                      }
                    />
                  ) : (
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
                  )
                )}
            </div>
          </section>
        ) : (
          <div className="mt-7 grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
            <section className="sl-surface min-w-0 p-4 sm:p-6">
              <StaticEventPlan zones={data.zones} />

              <SelectMenu
                className="mt-5 max-w-sm"
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
                {focusedZoneId ? (
                  <ZoneMap
                    mapImageUrl={null}
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
                ) : (
                  <div className="rounded-[24px] border border-dashed border-[#cfc3e8] bg-[#faf8ff] px-5 py-10 text-center">
                    <b className="block text-lg">เลือกโซนเพื่อดูบูธที่เปิดให้จอง</b>
                    <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-muted">
                      แผนผังภาพด้านบนใช้ดูตำแหน่งรวมเท่านั้น เมื่อเลือกโซน ระบบจะแสดงเฉพาะบูธในโซนนั้นโดยไม่ซูมหรือเปลี่ยนหน้า
                    </p>
                  </div>
                )}
              </div>
            </section>

            <aside className="sl-surface sticky top-[96px] p-6">
              <span className="text-xs font-bold uppercase tracking-[.13em] text-violet">
                Booking summary
              </span>
              <h2 className="mt-2 text-xl font-bold">
                {selectedBooth ? `บูธ ${selectedBooth.code}` : 'ยังไม่ได้เลือกบูธ'}
              </h2>
              {selectedBooth && (
                <dl className="mt-4 divide-y divide-line rounded-2xl bg-[#faf8ff] px-4 text-sm">
                  <SummaryRow
                    label="โซน"
                    value={selectedZone?.name ?? `โซน ${selectedZone?.code ?? '-'}`}
                  />
                  <SummaryRow
                    label="ขนาดพื้นที่"
                    value={`${selectedBooth.widthM ?? '-'} × ${selectedBooth.heightM ?? '-'} เมตร`}
                  />
                  <SummaryRow label="ระดับบูธ" value={selectedBooth.tier ?? 'มาตรฐาน'} />
                  <SummaryRow
                    label="สถานะ"
                    value={selectedBooth.availability === 'AVAILABLE' ? 'ว่าง พร้อมจอง' : selectedBooth.availability}
                  />
                  <SummaryRow
                    label="ราคา"
                    value={`${formatMoney(selectedBooth.boothPrice)} บาท`}
                  />
                </dl>
              )}

              {selectedBooth && (
                <div className="mt-4 rounded-2xl border border-[#dcd0f2] bg-violet-tint p-4 text-sm leading-6 text-[#5f3b9b]">
                  <b className="block text-ink">จุดเด่นของตำแหน่งนี้</b>
                  อยู่ใกล้ทางเดินหลัก มองเห็นง่าย และเหมาะกับสินค้าใน{' '}
                  {selectedZone?.categories.map((category) => category.name).join(', ') || 'โซนนี้'}
                </div>
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
                onClick={() => {
                  if (vendor.status === 'ready' && !shop) {
                    router.push('/profile');
                    return;
                  }
                  void handleCreate();
                }}
                disabled={
                  isCreating ||
                  !selectedBooth ||
                  vendor.status === 'loading' ||
                  vendor.status === 'signed-out' ||
                  vendor.status === 'error'
                }
                className="sl-action-primary mt-6 w-full"
              >
                {isCreating
                  ? 'กำลังสร้างการจอง…'
                  : vendor.status === 'ready' && !shop
                    ? 'เพิ่มข้อมูลร้านค้าก่อนจอง'
                    : 'ยืนยันและไปหน้าชำระเงิน'}
              </button>
            </aside>
          </div>
        )}
      </div>
    </main>
  );
}

function StaticEventPlan({ zones }: { zones: EventZone[] }) {
  const available = zones.reduce(
    (total, zone) =>
      total + zone.booths.filter((booth) => booth.availability === 'AVAILABLE').length,
    0,
  );

  return (
    <section className="overflow-hidden rounded-[24px] border border-[#d9d0e8] bg-[#f4f1f8]">
      <div className="flex flex-wrap items-center justify-between gap-4 bg-[#176c50] px-5 py-4 text-white">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[.14em] text-white/70">Event plan</p>
          <h2 className="font-extrabold">แผนผังภาพรวมงาน · สำหรับดูตำแหน่ง</h2>
        </div>
        <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-bold">{available} บูธว่าง</span>
      </div>
      <div className="relative aspect-[16/9] bg-[#edf4df]">
        <Image
          src="/event-plan-sut-2569.png"
          alt="แผนผังภาพรวมงาน แสดงตำแหน่งโซน A ถึง F ทางเข้า ทางออก จุดบริการ และที่จอดรถ"
          fill
          priority
          sizes="(max-width: 1024px) 100vw, 900px"
          className="object-cover"
        />
        <div className="absolute bottom-3 left-3 rounded-full bg-white/90 px-3 py-1.5 text-xs font-bold text-[#5a5364] shadow-sm backdrop-blur">
          ภาพแผนผังจากผู้จัดงาน · ไม่สามารถกดเลือกได้
        </div>
      </div>
    </section>
  );
}

function PaymentSummary({
  booking,
  event,
  booth,
  zoneName,
  shopName,
  holdExpired,
  onExpired,
  onChooseAgain,
}: {
  booking: BookingRecord;
  event: EventMap;
  booth: EventBooth | null;
  zoneName: string;
  shopName: string;
  holdExpired: boolean;
  onExpired: () => void;
  onChooseAgain: () => void;
}) {
  return (
    <div className="sl-surface overflow-hidden">
      <div className="bg-gradient-to-r from-[#5b21b6] to-[#7c3aed] px-6 py-5 text-white sm:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <span className="text-xs font-bold uppercase tracking-[.14em] text-white/70">Payment</span>
            <h2 className="mt-1 text-2xl font-black">ชำระเงินเพื่อยืนยันการจอง</h2>
          </div>
          <span className="rounded-full bg-white/15 px-4 py-2 text-sm font-bold backdrop-blur">
            <BookingCountdown
              expiresAt={booking.holdExpiresAt}
              active={booking.status === 'PENDING_PAYMENT'}
              onExpired={onExpired}
            />
          </span>
        </div>
      </div>

      <div className="p-6 sm:p-8">
        {booking.status === 'CONFIRMED' && (
          <div className="mb-5 rounded-2xl border border-[#b9dfd3] bg-[#effaf6] p-5 text-emerald">
            <b>ยืนยันการจองเรียบร้อยแล้ว</b>
            <p className="mt-1 text-sm">ระบบได้รับหลักฐานการชำระเงินและล็อกบูธนี้ให้ร้านของคุณแล้ว</p>
          </div>
        )}

        {holdExpired && (
          <div className="rounded-2xl border border-[#fac5bf] bg-[#fff0ee] p-5 text-[#9f2218]">
            <b>หมดเวลาชำระเงิน การจองนี้ถือเป็นโมฆะ</b>
            <p className="mt-1 text-sm">กรุณากลับไปเลือกบูธและเริ่มการจองใหม่อีกครั้ง</p>
            <button type="button" onClick={onChooseAgain} className="mt-4 rounded-xl bg-[#b42318] px-4 py-2 text-sm font-bold text-white">
              เลือกบูธใหม่
            </button>
          </div>
        )}

        <div className="mt-1 grid gap-5 sm:grid-cols-2">
          <div className="rounded-2xl border border-line bg-[#faf8ff] p-5">
            <span className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-[.1em] text-violet">
              <MapPin className="h-4 w-4" aria-hidden /> สถานที่จัดงาน
            </span>
            <h3 className="mt-3 font-black">{event.event.venue.name}</h3>
            <p className="mt-2 text-sm leading-6 text-muted">{event.event.venue.address ?? 'ยังไม่ระบุที่อยู่'}</p>
          </div>
          <div className="rounded-2xl border border-line bg-[#faf8ff] p-5">
            <span className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-[.1em] text-violet">
              <Building2 className="h-4 w-4" aria-hidden /> รายละเอียดการจอง
            </span>
            <p className="mt-3 text-sm text-muted">รหัสการจอง</p>
            <b className="block">{booking.bookingCode}</b>
            <p className="mt-2 text-sm text-muted">ร้านค้า</p>
            <b className="block">{shopName}</b>
          </div>
        </div>

        <dl className="mt-6 divide-y divide-line text-sm">
          <SummaryRow label="Event" value={event.event.name} />
          <SummaryRow label="บูธ / โซน" value={`${booth?.code ?? booking.boothId} / ${zoneName}`} />
          <SummaryRow label="ขนาดพื้นที่" value={`${booth?.widthM ?? '-'} × ${booth?.heightM ?? '-'} เมตร`} />
          <SummaryRow label="ค่าบูธ" value={`${formatMoney(booking.boothPrice)} บาท`} />
          <SummaryRow label="ค่าธรรมเนียมระบบ" value="0 บาท" />
        </dl>
        <div className="mt-5 flex items-end justify-between rounded-2xl bg-[#201b2e] px-5 py-4 text-white">
          <span className="text-sm text-white/70">ยอดชำระทั้งหมด</span>
          <strong className="text-2xl">{formatMoney(booking.boothPrice)} บาท</strong>
        </div>

        {canUseUxPreview() && booking.status === 'PENDING_PAYMENT' && !holdExpired ? (
          <button
            type="button"
            onClick={onExpired}
            className="mt-4 w-full rounded-xl border border-dashed border-[#cfbded] px-4 py-2.5 text-sm font-bold text-violet hover:bg-violet-tint"
          >
            ทดสอบกรณีหมดเวลาชำระเงิน
          </button>
        ) : null}
      </div>
    </div>
  );
}

function PreviewSlipUploadPanel({
  disabled,
  onConfirmed,
}: {
  disabled: boolean;
  onConfirmed: () => void;
}) {
  const [fileName, setFileName] = useState<string | null>(null);

  const handleFile = (event: ChangeEvent<HTMLInputElement>) => {
    setFileName(event.target.files?.[0]?.name ?? null);
  };

  return (
    <section className="sl-surface p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-violet-tint text-violet">
          <ShieldCheck className="h-5 w-5" aria-hidden />
        </span>
        <div>
          <h2 className="text-lg font-extrabold">แนบหลักฐานการชำระเงิน</h2>
          <p className="mt-1 text-sm leading-6 text-muted">
            เลือกรูปสลิป JPEG หรือ PNG ขนาดไม่เกิน 5 MB เพื่อทดสอบหน้าจอ โดยโหมดนี้จะไม่ส่งข้อมูลออกจากเครื่อง
          </p>
        </div>
      </div>

      <label className="mt-5 block text-sm font-bold" htmlFor="preview-slip">
        รูปสลิปการโอนเงิน
      </label>
      <input
        id="preview-slip"
        type="file"
        accept="image/jpeg,image/png"
        disabled={disabled}
        onChange={handleFile}
        className="mt-2 block w-full rounded-2xl border border-dashed border-[#cfc3e8] bg-[#faf8ff] p-3 text-sm file:mr-4 file:rounded-xl file:border-0 file:bg-[#ede7ff] file:px-4 file:py-2.5 file:font-bold file:text-violet"
      />
      {fileName ? <p className="mt-2 text-xs text-muted">เลือกแล้ว: {fileName}</p> : null}

      <button
        type="button"
        disabled={!fileName || disabled}
        onClick={onConfirmed}
        className="sl-action-primary mt-4 w-full"
      >
        <ShieldCheck className="h-4 w-4" aria-hidden />
        ทดสอบตรวจสลิปและยืนยันการจอง
      </button>
    </section>
  );
}

function PaymentMethodPanel({
  method,
  onChange,
  amount,
  disabled,
}: {
  method: PaymentMethod;
  onChange: (method: PaymentMethod) => void;
  amount: string;
  disabled: boolean;
}) {
  const methods = [
    { id: 'qr' as const, label: 'QR Code', icon: QrCode },
    { id: 'bank' as const, label: 'ธนาคารออนไลน์', icon: Landmark },
  ];

  return (
    <section className="sl-surface p-5 sm:p-6">
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-2xl bg-violet-tint text-violet">
          <ShieldCheck className="h-5 w-5" aria-hidden />
        </span>
        <div>
          <h2 className="font-black">เลือกวิธีชำระเงิน</h2>
          <p className="text-xs text-muted">ข้อมูลการชำระเงินจะถูกเข้ารหัสอย่างปลอดภัย</p>
        </div>
      </div>

      <div className="mt-5 grid gap-2">
        {methods.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => onChange(id)}
            disabled={disabled}
            className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-left text-sm font-bold transition disabled:opacity-50 ${
              method === id
                ? 'border-violet bg-violet-tint text-violet'
                : 'border-line bg-white text-ink'
            }`}
          >
            <Icon className="h-5 w-5" aria-hidden />
            {label}
            <span className={`ml-auto h-4 w-4 rounded-full border-4 ${method === id ? 'border-violet' : 'border-[#d5cfdd]'}`} />
          </button>
        ))}
      </div>

      {method === 'qr' && (
        <div className="mt-5 rounded-2xl bg-[#faf8ff] p-5 text-center">
          <span className="mx-auto grid h-40 w-40 place-items-center rounded-2xl border-8 border-white bg-[repeating-conic-gradient(#201b2e_0_25%,#fff_0_50%)] bg-[length:16px_16px] shadow-sm">
            <span className="grid h-14 w-14 place-items-center rounded-xl bg-white text-violet shadow">
              <QrCode className="h-9 w-9" aria-hidden />
            </span>
          </span>
          <b className="mt-4 block">สแกนเพื่อชำระ {formatMoney(amount)} บาท</b>
          <p className="mt-1 text-xs text-muted">QR ตัวอย่างสำหรับตรวจ UX/UI — ยังไม่ใช่ QR รับเงินจริง</p>
        </div>
      )}

      {method === 'bank' && (
        <div className="mt-5 grid grid-cols-2 gap-3 rounded-2xl bg-[#faf8ff] p-4">
          {['K PLUS', 'SCB EASY', 'Krungthai NEXT', 'Bualuang mBanking'].map((bank) => (
            <button key={bank} type="button" className="rounded-xl border border-line bg-white px-3 py-3 text-xs font-extrabold">
              {bank}
            </button>
          ))}
        </div>
      )}
    </section>
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
