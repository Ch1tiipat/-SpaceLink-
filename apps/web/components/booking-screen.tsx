'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { type ChangeEvent, useEffect, useMemo, useState } from 'react';
import {
  Building2,
  MapPin,
  QrCode,
  ShieldCheck,
} from 'lucide-react';
import { BookingCountdown } from '@/components/booking-countdown';
import { SlipUploadPanel } from '@/components/slip-upload-panel';
import {
  createBooking,
  createBookingsBatch,
  getAverageRating,
  getEventMap,
  getEventMapBySlug,
  getMyBookings,
  type BookingRecord,
  type AverageRating,
  type EventBooth,
  type EventMap,
} from '@/lib/api';
import { isEventBookable } from '@/lib/event-booking-rules';
import { isUuid } from '@/lib/route-identifier';
import { useVendorProfile } from '@/lib/use-vendor-profile';
import { canUseUxPreview } from '@/lib/ux-preview';

const HOLD_STATUS_REFRESH_ATTEMPTS = 13;
const HOLD_STATUS_REFRESH_INTERVAL_MS = 5_000;
const MAX_SELECTED_BOOTHS = 10;

type BoothRatingState =
  | { status: 'idle' }
  | { status: 'loading' | 'error'; boothId: string }
  | { status: 'ready'; boothId: string; value: AverageRating };

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
  const searchParams = useSearchParams();
  const requestedZoneCode = searchParams.get('zone');
  const requestedBoothCode = searchParams.get('booth');
  const requestedBoothsValue = searchParams.get('booths');
  const multiSelectionMode = requestedBoothsValue !== null;
  const requestedBoothCodes = useMemo(() => {
    if (requestedBoothsValue === null) return [];
    const seen = new Set<string>();
    return requestedBoothsValue
      .split(',')
      .map((code) => code.trim())
      .filter((code) => {
        const key = code.toLocaleLowerCase();
        if (!code || seen.has(key)) return false;
        seen.add(key);
        return true;
      });
  }, [requestedBoothsValue]);
  const { state: vendor } = useVendorProfile();
  const [data, setData] = useState<EventMap | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [focusedZoneId, setFocusedZoneId] = useState<string | null>(null);
  const [selectedBooths, setSelectedBooths] = useState<EventBooth[]>([]);
  const [createdBooking, setCreatedBooking] = useState<BookingRecord | null>(
    null,
  );
  const [holdExpired, setHoldExpired] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [boothRating, setBoothRating] = useState<BoothRatingState>({
    status: 'idle',
  });

  useEffect(() => {
    const controller = new AbortController();
    const legacyUuid = isUuid(eventId);
    const request = legacyUuid ? getEventMap : getEventMapBySlug;
    request(eventId, controller.signal)
      .then((eventMap) => {
        setData(eventMap);
        if (legacyUuid) {
          router.replace(
            `/events/${encodeURIComponent(eventMap.event.slug)}/book${window.location.search}`,
          );
        }
      })
      .catch((cause: unknown) => {
        if (cause instanceof DOMException && cause.name === 'AbortError') return;
        setLoadError(
          cause instanceof Error ? cause.message : 'โหลดข้อมูล Event ไม่สำเร็จ',
        );
      });
    return () => controller.abort();
  }, [eventId, router]);

  useEffect(() => {
    if (!data) return;

    if (multiSelectionMode) {
      const availableBooths = data.zones.flatMap((zone) => zone.booths);
      const requestedBooths = requestedBoothCodes.flatMap((code) => {
        const booth = availableBooths.find(
          (candidate) =>
            candidate.code.toLocaleLowerCase() === code.toLocaleLowerCase() &&
            candidate.availability === 'AVAILABLE',
        );
        return booth ? [booth] : [];
      });
      setSelectedBooths(requestedBooths.slice(0, MAX_SELECTED_BOOTHS));
      const firstZone = data.zones.find((zone) =>
        zone.booths.some((booth) => booth.id === requestedBooths[0]?.id),
      );
      setFocusedZoneId(firstZone?.id ?? null);
      return;
    }

    if (!requestedZoneCode && !requestedBoothCode) return;
    const requestedZone = data.zones.find(
      (zone) =>
        zone.code.toLowerCase() === requestedZoneCode?.toLowerCase() ||
        zone.booths.some(
          (booth) => booth.code.toLowerCase() === requestedBoothCode?.toLowerCase(),
        ),
    );
    if (!requestedZone) return;
    setFocusedZoneId(requestedZone.id);

    if (requestedBoothCode) {
      const requestedBooth = requestedZone.booths.find(
        (booth) =>
          booth.code.toLowerCase() === requestedBoothCode.toLowerCase() &&
          booth.availability === 'AVAILABLE',
      );
      if (requestedBooth) setSelectedBooths([requestedBooth]);
    }
  }, [
    data,
    multiSelectionMode,
    requestedBoothCode,
    requestedBoothCodes,
    requestedZoneCode,
  ]);

  const selectedBooth = selectedBooths[0] ?? null;
  const selectedBoothId =
    selectedBooths.length === 1 ? selectedBooth?.id ?? null : null;

  useEffect(() => {
    if (!selectedBoothId) {
      setBoothRating({ status: 'idle' });
      return;
    }

    const controller = new AbortController();
    setBoothRating({ status: 'loading', boothId: selectedBoothId });
    getAverageRating('BOOTH', selectedBoothId, controller.signal)
      .then((value) =>
        setBoothRating({
          status: 'ready',
          boothId: selectedBoothId,
          value,
        }),
      )
      .catch((cause: unknown) => {
        if (cause instanceof DOMException && cause.name === 'AbortError') return;
        setBoothRating({ status: 'error', boothId: selectedBoothId });
      });

    return () => controller.abort();
  }, [selectedBoothId]);

  const selectedZone = useMemo(
    () =>
      data?.zones.find((zone) =>
        zone.booths.some((booth) => booth.id === selectedBooth?.id),
      ) ?? null,
    [data, selectedBooth],
  );
  const selectedBoothDetails = useMemo(
    () =>
      selectedBooths.map((booth) => ({
        booth,
        zone:
          data?.zones.find((zone) =>
            zone.booths.some((candidate) => candidate.id === booth.id),
          ) ?? null,
      })),
    [data, selectedBooths],
  );
  const selectedTotal = useMemo(
    () =>
      Math.round(
        selectedBooths.reduce((sum, booth) => {
          const price = Number(booth.boothPrice);
          return sum + (Number.isFinite(price) ? price : 0);
        }, 0) * 100,
      ) / 100,
    [selectedBooths],
  );
  const focusedZone = useMemo(
    () => data?.zones.find((zone) => zone.id === focusedZoneId) ?? null,
    [data, focusedZoneId],
  );
  const bookingMetrics = useMemo(() => {
    const zones = data?.zones ?? [];
    const booths = zones.flatMap((zone) => zone.booths);
    const prices = booths
      .map((booth) => Number(booth.boothPrice))
      .filter(Number.isFinite);

    return {
      zoneCount: zones.length,
      boothCount: booths.length,
      availableCount: booths.filter(
        (booth) => booth.availability === 'AVAILABLE',
      ).length,
      startingPrice: prices.length ? Math.min(...prices) : null,
    };
  }, [data]);
  // A vendor owns one shop at most, so there is nothing to pick: the booking
  // uses the shop the account already has, or it cannot be made at all.
  const shop = vendor.status === 'ready' ? vendor.shop : null;
  const ratingLabel =
    boothRating.status === 'idle' || boothRating.boothId !== selectedBoothId
      ? 'กำลังโหลดคะแนน…'
      : boothRating.status === 'loading'
      ? 'กำลังโหลดคะแนน…'
      : boothRating.status === 'error'
        ? 'โหลดคะแนนไม่ได้'
        : boothRating.status === 'ready' && boothRating.value.average !== null
          ? `${boothRating.value.average.toFixed(1)} ★ (${boothRating.value.count} รีวิว)`
          : 'ยังไม่มีรีวิว';

  function selectBooth(booth: EventBooth) {
    if (!multiSelectionMode) {
      setSelectedBooths([booth]);
      setActionError(null);
      return;
    }

    if (selectedBooths.some((candidate) => candidate.id === booth.id)) {
      setSelectedBooths((current) =>
        current.filter((candidate) => candidate.id !== booth.id),
      );
      setActionError(null);
      return;
    }

    if (selectedBooths.length >= MAX_SELECTED_BOOTHS) {
      setActionError(
        `เลือกได้สูงสุด ${MAX_SELECTED_BOOTHS} บูธต่อการยืนยันหนึ่งครั้ง`,
      );
      return;
    }

    setSelectedBooths((current) => [...current, booth]);
    setActionError(null);
  }

  async function handleCreate() {
    if (
      vendor.status !== 'ready' ||
      !vendor.shop ||
      selectedBooths.length === 0 ||
      !data ||
      !isEventBookable(data.event)
    ) {
      return;
    }

    setIsCreating(true);
    setActionError(null);
    try {
      if (selectedBooths.length > 1) {
        if (!canUseUxPreview()) {
          await createBookingsBatch(
            {
              eventId: data.event.id,
              shopId: vendor.shop.id,
              boothIds: selectedBooths.map((booth) => booth.id),
            },
            vendor.token,
          );
        }
        router.push('/bookings?tab=pending');
        return;
      }

      const selectedBooth = selectedBooths[0];
      if (!selectedBooth) return;
      const now = new Date();
      const booking: BookingRecord = canUseUxPreview()
        ? {
            id: 'local-preview-booking',
            bookingCode: 'SL-DEMO-2569',
            eventId: data.event.id,
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
            {
              eventId: data.event.id,
              boothId: selectedBooth.id,
              shopId: vendor.shop.id,
            },
            vendor.token,
          );
      setCreatedBooking(booking);
      setHoldExpired(false);

      router.push(`/bookings/${encodeURIComponent(booking.bookingCode)}/payment`);
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
          <Link href="/" className="mt-7 inline-flex rounded-xl bg-violet px-5 py-3 font-bold text-white">
            กลับหน้าค้นหา Event
          </Link>
        </div>
      </main>
    );
  }

  const eventBookable = isEventBookable(data.event);

  return (
    <main className="sl-page pb-16">
      <div className="shell max-w-[1180px] py-6">
        <Link
          href={`/events/${encodeURIComponent(data.event.slug)}/map${requestedZoneCode ? `?zone=${encodeURIComponent(requestedZoneCode)}` : ''}`}
          className="sl-chip min-h-9 px-3 text-sm"
        >
          ← กลับไปแผนผัง Event
        </Link>

        {vendor.status === 'signed-out' || vendor.status === 'error' || (vendor.status === 'ready' && !shop) ? (
          <section className="mt-4 grid grid-cols-[42px_minmax(0,1fr)_auto] items-center gap-3 rounded-[15px] border border-[#ebc8cf] bg-[#fff7f8] p-3 max-sm:grid-cols-[42px_minmax(0,1fr)]">
            <span className="grid h-[42px] w-[42px] place-items-center rounded-[12px] bg-[#ffe7eb] font-black text-[#b43748]">!</span>
            <div>
              <strong className="block text-sm text-[#a93545]">ยังไม่สามารถสร้าง Booking ได้</strong>
              <p className="mt-1 text-sm text-[#8f6269]">
                {vendor.status === 'signed-out'
                  ? 'กรุณาเข้าสู่ระบบผู้ขายก่อนเลือกและยืนยัน Booth'
                  : vendor.status === 'error'
                    ? vendor.message
                    : 'บัญชีนี้ยังไม่มีข้อมูลร้านค้า กรุณาตั้งค่าร้านก่อนจองพื้นที่'}
              </p>
            </div>
            <Link href={vendor.status === 'signed-out' ? '/login' : '/profile'} className="sl-chip min-h-9 whitespace-nowrap text-sm max-sm:col-span-2">
              {vendor.status === 'signed-out' ? 'เข้าสู่ระบบ →' : 'ตั้งค่าร้านค้า →'}
            </Link>
          </section>
        ) : null}

        <header className="mt-4 flex items-end justify-between gap-5 max-sm:flex-col max-sm:items-start">
          <div>
            <span className="sl-kicker">BOOTH RESERVATION</span>
            <h1 className="mt-1 text-[30px] font-black tracking-[-0.045em] max-sm:text-2xl">เลือก Booth และตรวจสอบการจอง</h1>
            <p className="mt-1 text-sm text-muted">
              <strong className="text-[#5c5061]">{data.event.name}</strong>
            </p>
          </div>
          <span className={`rounded-full px-3 py-2 text-sm font-extrabold ${eventBookable ? 'bg-[#e5f7ed] text-[#15794a]' : 'bg-[#ffe9ec] text-[#ae3949]'}`}>
            {eventBookable ? 'เปิดให้จอง' : 'ปิดรับจอง'}
          </span>
        </header>

        {!eventBookable ? (
          <section className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-[15px] border border-[#ebc8cf] bg-[#fff7f8] p-4">
            <div>
              <strong className="block text-sm text-[#a93545]">Event นี้ปิดรับจองแล้ว</strong>
              <p className="mt-1 text-sm text-[#8f6269]">ดูข้อมูล Zone และ Booth ได้ แต่ไม่สามารถสร้าง Booking ใหม่สำหรับ Event นี้</p>
            </div>
            <Link href="/" className="sl-chip min-h-9 whitespace-nowrap text-sm">ค้นหา Event อื่น →</Link>
          </section>
        ) : null}

        {!createdBooking ? (
          <>
            <ol className="mt-4 grid gap-2 rounded-[16px] border border-line bg-white p-2 sm:grid-cols-3">
              {[
                ['1', 'เลือกบูธ', 'เลือกพื้นที่จาก Event Map'],
                ['2', 'ตรวจสอบข้อมูล', 'ตรวจร้าน ราคา และสถานะ'],
                ['3', 'ชำระเงิน', 'Hold บูธตามเวลาที่กำหนด'],
              ].map(([number, label, detail], index) => (
                <li
                  key={number}
                  className={`flex min-h-[55px] items-center gap-3 rounded-[11px] px-3 py-2 ${
                    index === 0 && selectedBooths.length > 0 ? 'bg-[#f1faf5] text-[#15794a]' : index <= 1 ? 'bg-violet-tint text-violet' : 'text-muted'
                  }`}
                >
                  <span
                    className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white text-sm font-black text-current"
                  >
                    {index === 0 && selectedBooths.length > 0 ? '✓' : number}
                  </span>
                  <div><strong className="block text-sm">{label}</strong><small className="mt-0.5 block text-xs opacity-65">{detail}</small></div>
                </li>
              ))}
            </ol>

            <section
              className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4"
              aria-label="สรุปพื้นที่ที่เปิดให้จอง"
            >
              {[
                ['Zone', bookingMetrics.zoneCount, 'AVAILABLE ZONES'],
                ['Booth ทั้งหมด', bookingMetrics.boothCount, 'ALL BOOTHS'],
                ['Booth ว่าง', bookingMetrics.availableCount, 'AVAILABLE'],
                [
                  'ราคาเริ่มต้น',
                  bookingMetrics.startingPrice === null
                    ? '–'
                    : `${formatMoney(String(bookingMetrics.startingPrice))} ฿`,
                  'STARTING PRICE',
                ],
              ].map(([label, value, caption]) => (
                <article key={label} className="rounded-[14px] border border-line bg-white p-3">
                  <p className="text-xs font-bold text-muted">{label}</p>
                  <strong className="mt-1 block text-xl font-black text-ink">
                    {value}
                  </strong>
                  <p className="mt-0.5 text-xs font-extrabold tracking-[.08em] text-[#aaa0ad]">
                    {caption}
                  </p>
                </article>
              ))}
            </section>
          </>
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
                setSelectedBooths([]);
              }}
            />

            <div className="grid gap-5">
              <PaymentMethodPanel
                amount={createdBooking.boothPrice}
                paymentQrDataUri={createdBooking.paymentQrDataUri ?? null}
              />

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
          <div className="mt-4 grid items-start gap-3 xl:grid-cols-[minmax(0,1fr)_350px]">
            <section className="sl-surface min-w-0 p-4">
              <div className="flex min-h-[58px] flex-wrap items-center justify-between gap-3 rounded-[14px] bg-[linear-gradient(105deg,#176c50,#238866)] px-4 py-3 text-white">
                <div><span className="text-xs font-extrabold tracking-[.1em] text-white/70">EVENT PLAN</span><strong className="mt-1 block text-sm">เลือก Zone และ Booth</strong></div>
                <span className="rounded-full bg-white/15 px-3 py-1.5 text-xs font-bold">{bookingMetrics.availableCount}/{bookingMetrics.boothCount} Booth ว่าง</span>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {data.zones.map((zone) => {
                  const available = zone.booths.filter(
                    (booth) => booth.availability === 'AVAILABLE',
                  ).length;
                  const selected = focusedZoneId === zone.id;

                  return (
                    <button
                      key={zone.id}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => {
                        setFocusedZoneId(zone.id);
                        if (!multiSelectionMode) setSelectedBooths([]);
                      }}
                      className={`min-h-[88px] rounded-[13px] border p-3 text-left transition ${
                        selected
                          ? 'border-violet bg-[#f2eaff] shadow-[0_0_0_3px_rgba(124,58,237,.07)]'
                          : 'border-dashed border-[#bfa8df] bg-[#faf7ff] hover:-translate-y-0.5 hover:border-violet'
                      }`}
                    >
                      <span className="text-xs font-extrabold uppercase tracking-[.12em] text-violet">
                        Zone {zone.code}
                      </span>
                      <strong className="mt-1 block line-clamp-1 text-sm text-ink">
                        {zone.name ?? 'ยังไม่ระบุชื่อโซน'}
                      </strong>
                      <span className="mt-1.5 block text-xs font-bold text-[#8d759f]">
                        {available}/{zone.booths.length} Booth ว่าง
                      </span>
                    </button>
                  );
                })}
              </div>

              <label className="mt-4 grid max-w-[420px] gap-1.5 text-sm font-bold text-[#6c6070]">
                เลือก Zone
                <select
                  value={focusedZoneId ?? ''}
                  onChange={(event) => {
                    setFocusedZoneId(event.target.value || null);
                    if (!multiSelectionMode) setSelectedBooths([]);
                  }}
                  className="h-10 rounded-[10px] border border-[#ddd3e2] bg-[#fcfbfd] px-3 text-base text-[#493e4e] outline-none focus:border-[#ad8bdd] focus:ring-4 focus:ring-violet/5"
                >
                  <option value="">เลือก Zone</option>
                  {data.zones.map((zone) => <option key={zone.id} value={zone.id}>{zone.code} — {zone.name ?? 'ไม่ระบุชื่อโซน'}</option>)}
                </select>
              </label>

              <div className="mt-3">
                {focusedZone ? (
                  <div>
                    <div className="flex items-center justify-between gap-3 border-b border-line pb-2">
                      <div><strong className="text-sm">Booth ใน Zone {focusedZone.code}</strong><p className="mt-0.5 text-xs text-muted">เลือกเฉพาะ Booth ที่มีสถานะว่าง</p></div>
                      <span className="sl-chip min-h-7 px-2 text-xs">{focusedZone.booths.filter((booth) => booth.availability === 'AVAILABLE').length} ว่าง</span>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                      {focusedZone.booths.map((booth) => {
                        const available = booth.availability === 'AVAILABLE';
                        const selected = selectedBooths.some(
                          (candidate) => candidate.id === booth.id,
                        );
                        const statusClass = booth.availability === 'BOOKED'
                          ? 'border-[#2a9b67] bg-[#effaf5] text-[#17734e]'
                          : booth.availability === 'HELD'
                            ? 'border-[#e7a339] bg-[#fff8ec] text-[#9d620c]'
                            : booth.availability === 'UNAVAILABLE'
                              ? 'border-dashed border-[#d3ccd6] bg-[#efedef] text-[#918996]'
                              : selected
                                ? 'border-violet bg-[linear-gradient(135deg,#8b5cf6,#6d28d9)] text-white shadow-[0_9px_20px_rgba(124,58,237,.18)]'
                                : 'border-[#bca6dd] bg-white text-[#6330c7] hover:-translate-y-0.5 hover:border-violet hover:bg-[#faf7ff]';

                        return (
                          <button
                            key={booth.id}
                            type="button"
                            disabled={!available}
                            aria-pressed={selected}
                            aria-label={`Booth ${booth.code} ${booth.availability}`}
                            onClick={() => selectBooth(booth)}
                            className={`min-h-[70px] rounded-[12px] border p-2 text-center transition disabled:cursor-not-allowed ${statusClass}`}
                          >
                            <strong className="block text-sm">{booth.code}</strong>
                            <span className={`mt-1 block text-xs ${selected ? 'text-white/80' : 'opacity-75'}`}>
                              {available ? `${formatMoney(booth.boothPrice)} บาท` : booth.availability === 'BOOKED' ? 'จองแล้ว' : booth.availability === 'HELD' ? 'กำลังจอง' : 'ปิดใช้งาน'}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-[15px] border border-dashed border-[#cfc3e8] bg-[#faf8ff] px-5 py-8 text-center">
                    <span className="mx-auto grid h-11 w-11 place-items-center rounded-[13px] bg-[#eee7fb] text-violet">▣</span>
                    <b className="mt-2 block text-sm">เลือก Zone เพื่อดู Booth</b>
                    <p className="mx-auto mt-1 max-w-md text-sm leading-5 text-muted">
                      หากเข้ามาจาก Event Map ระบบจะเลือก Zone และ Booth ให้โดยอัตโนมัติ
                    </p>
                  </div>
                )}
              </div>
            </section>

            <aside className="sl-surface sticky top-[92px] p-4">
              <span className="text-xs font-bold uppercase tracking-[.13em] text-violet">
                Booking summary
              </span>
              <h2 className="mt-1 text-lg font-black">
                {selectedBooths.length > 1
                  ? `${selectedBooths.length} Booth ที่เลือก`
                  : selectedBooth
                    ? `Booth ${selectedBooth.code}`
                    : 'ยังไม่ได้เลือก Booth'}
              </h2>
              {selectedBooths.length > 1 ? (
                <div className="mt-3 grid gap-2">
                  {selectedBoothDetails.map(({ booth, zone }) => (
                    <div
                      key={booth.id}
                      className="flex items-center justify-between gap-3 rounded-[11px] border border-[#dfd2f1] bg-[#faf8ff] px-3 py-2"
                    >
                      <div>
                        <strong className="block text-sm">
                          Zone {zone?.code ?? '-'} · Booth {booth.code}
                        </strong>
                        <span className="text-xs text-muted">
                          {formatMoney(booth.boothPrice)} บาท
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => selectBooth(booth)}
                        className="sl-chip min-h-8 px-2 text-xs text-violet"
                        aria-label={`นำ Booth ${booth.code} ออกจากรายการ`}
                      >
                        นำออก
                      </button>
                    </div>
                  ))}
                  <div className="flex items-center justify-between border-t border-line pt-3">
                    <strong className="text-sm">ราคารวม</strong>
                    <strong className="text-lg text-violet">
                      {formatMoney(String(selectedTotal))} บาท
                    </strong>
                  </div>
                  <p className="text-xs leading-5 text-muted">
                    ระบบจะสร้าง Booking และรายการชำระเงินแยกสำหรับทุก Booth
                  </p>
                </div>
              ) : selectedBooth ? (
                <>
                <dl className="mt-3 divide-y divide-line rounded-[12px] bg-[#faf8ff] px-3 text-sm">
                  <SummaryRow
                    label="Zone"
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
                  <SummaryRow label="คะแนนพื้นที่" value={ratingLabel} />
                  <SummaryRow
                    label="ราคา"
                    value={`${formatMoney(selectedBooth.boothPrice)} บาท`}
                  />
                </dl>
                <div className="mt-2 rounded-[11px] border border-[#dfd2f1] bg-[#f8f4ff] p-3 text-sm leading-5 text-[#603594]">
                  <b className="block text-ink">เหมาะกับร้านในหมวด</b>
                  {selectedZone?.categories.map((category) => category.name).join(', ') || 'ตามประเภทสินค้าที่ผู้จัดงานกำหนด'}
                </div>
                </>
              ) : <div className="mt-3 rounded-[12px] bg-[#f8f6f9] px-3 py-5 text-center text-sm leading-5 text-muted">เลือก Booth ทางด้านซ้ายเพื่อดูรายละเอียดก่อนสร้าง Booking</div>}

              <section className="mt-3 border-t border-line pt-3">
                <span className="block text-xs font-extrabold tracking-[.1em] text-muted">ร้านค้าที่ใช้จอง</span>
                {vendor.status === 'loading' && (
                  <p className="mt-2 text-sm text-muted">กำลังตรวจสอบบัญชีผู้ขาย…</p>
                )}
                {vendor.status === 'signed-out' && (
                  <p className="mt-2 text-sm text-muted">
                    กรุณา <Link href="/login" className="font-bold text-violet">เข้าสู่ระบบ</Link> ก่อนจองบูธ
                  </p>
                )}
                {vendor.status === 'error' && (
                  <p className="mt-2 text-sm text-[#b42318]">{vendor.message}</p>
                )}
                {vendor.status === 'ready' && !shop && (
                  <p className="mt-2 text-sm">
                    <Link href="/profile" className="font-bold text-violet underline">
                      บัญชีนี้ยังไม่มีร้านค้า จึงยังไม่สามารถสร้างการจองได้
                    </Link>
                  </p>
                )}
                {vendor.status === 'ready' && shop && (
                  <div className="mt-2 flex items-center gap-3">
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[12px] bg-[linear-gradient(135deg,#8b5cf6,#6831d0)] text-sm font-black text-white">{shop.name.trim().charAt(0) || 'S'}</span>
                    <div className="min-w-0"><b className="block truncate text-sm">{shop.name}</b><small className="mt-1 block truncate text-xs text-muted">{shop.categories.map((category) => category.name).join(' · ') || 'ยังไม่ระบุหมวดสินค้า'}</small><code className="mt-1 block truncate text-xs text-[#9a8fa0]">{shop.id}</code></div>
                  </div>
                )}
              </section>

              <section className="mt-3 rounded-[12px] border border-[#e8e0ec] bg-[#fcfbfd] p-3">
                <span className="text-xs font-extrabold tracking-[.1em] text-violet">BOOKING POLICY</span>
                <strong className="mt-1 block text-sm">เงื่อนไขก่อนสร้าง Booking</strong>
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-[9px] bg-white p-2"><span className="text-muted">Event</span><b className="mt-1 block">{eventBookable ? 'เปิดให้จอง' : 'ปิดรับจอง'}</b></div>
                  <div className="rounded-[9px] bg-white p-2"><span className="text-muted">Booth</span><b className="mt-1 block">{!eventBookable ? 'ไม่เปิดให้สร้างรายการ' : selectedBooths.length > 1 ? `${selectedBooths.length} Booth พร้อมสร้างรายการ` : selectedBooth ? 'พร้อมสร้างรายการ' : 'รอเลือกพื้นที่'}</b></div>
                </div>
              </section>

              <section className="mt-3 rounded-[12px] border border-[#d9e6dc] bg-[#f8fcf9] p-3">
                <div className="flex items-start justify-between gap-2"><div><span className="text-xs font-extrabold text-muted">PAYMENT RECEIVER</span><strong className="mt-1 block text-sm">{data.event.organization.name}</strong></div><b className={`rounded-full px-2 py-1 text-xs ${eventBookable ? 'bg-[#e5f7ed] text-[#15794a]' : 'bg-[#f1eef2] text-muted'}`}>{eventBookable ? 'พร้อมรับชำระ' : 'ปิดรับรายการ'}</b></div>
                <p className="mt-2 text-xs font-bold text-[#4e694f]">{data.event.organization.contactEmail}</p>
                <small className="mt-1 block text-xs leading-4 text-[#829084]">
                  {selectedBooths.length > 1
                    ? 'ระบบจะ Hold แต่ละ Booth แยกกัน และให้ชำระเงินทีละ Booking'
                    : 'หลังสร้าง Booking ระบบจะพาไปหน้าชำระเงินและ Hold Booth ตามเวลาที่ระบบกำหนด'}
                </small>
              </section>

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
                  !eventBookable ||
                  selectedBooths.length === 0 ||
                  vendor.status === 'loading' ||
                  vendor.status === 'signed-out' ||
                  vendor.status === 'error'
                }
                className="sl-action-primary mt-3 w-full text-sm"
              >
                {isCreating
                  ? 'กำลังสร้างการจอง…'
                  : !eventBookable
                    ? 'Event นี้ปิดรับจองแล้ว'
                  : vendor.status === 'ready' && !shop
                    ? 'เพิ่มข้อมูลร้านค้าก่อนจอง'
                    : selectedBooths.length > 1
                      ? `สร้าง ${selectedBooths.length} Booking →`
                      : 'สร้าง Booking และไปชำระเงิน →'}
              </button>
            </aside>
          </div>
        )}
      </div>
    </main>
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

export function PreviewSlipUploadPanel({
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
        className="mt-2 block w-full rounded-2xl border border-dashed border-[#cfc3e8] bg-[#faf8ff] p-3 text-base file:mr-4 file:rounded-xl file:border-0 file:bg-[#ede7ff] file:px-4 file:py-2.5 file:font-bold file:text-violet"
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
  amount,
  paymentQrDataUri,
}: {
  amount: string;
  paymentQrDataUri: string | null;
}) {
  return (
    <section className="sl-surface p-5 sm:p-6">
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-2xl bg-violet-tint text-violet">
          <ShieldCheck className="h-5 w-5" aria-hidden />
        </span>
        <div>
          <h2 className="font-black">ชำระเงินด้วย PromptPay QR</h2>
          <p className="text-xs text-muted">ข้อมูลการชำระเงินจะถูกเข้ารหัสอย่างปลอดภัย</p>
        </div>
      </div>

      <div className="mt-5 flex items-center gap-3 rounded-2xl border border-violet bg-violet-tint px-4 py-3 text-sm font-bold text-violet">
        <QrCode className="h-5 w-5" aria-hidden />
        PromptPay QR
        <span className="ml-auto" aria-hidden>✓</span>
      </div>

      <div className="mt-5 rounded-2xl bg-[#faf8ff] p-5 text-center">
        {paymentQrDataUri ? (
          <Image
            src={paymentQrDataUri}
            alt="QR Code PromptPay สำหรับชำระค่าบูธ"
            width={320}
            height={320}
            unoptimized
            className="mx-auto h-40 w-40 rounded-2xl border-8 border-white bg-white shadow-sm"
          />
        ) : (
          <span className="mx-auto grid h-40 w-40 place-items-center rounded-2xl border-8 border-white bg-[repeating-conic-gradient(#201b2e_0_25%,#fff_0_50%)] bg-[length:16px_16px] shadow-sm">
            <span className="grid h-14 w-14 place-items-center rounded-xl bg-white text-violet shadow">
              <QrCode className="h-9 w-9" aria-hidden />
            </span>
          </span>
        )}
        <b className="mt-4 block">สแกนเพื่อชำระ {formatMoney(amount)} บาท</b>
        {!paymentQrDataUri ? (
          <p className="mt-1 text-xs text-muted">QR ตัวอย่างสำหรับตรวจ UX/UI — ยังไม่ใช่ QR รับเงินจริง</p>
        ) : (
          <p className="mt-1 text-xs text-muted">QR PromptPay สร้างจากบัญชีรับเงินของผู้จัดงานและยอดค่าบูธรายการนี้</p>
        )}
      </div>
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
