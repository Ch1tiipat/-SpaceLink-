'use client';

import Image from 'next/image';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { EventBooth, EventZone } from '@/lib/api';

/**
 * Zones are distinguished by depth within one violet family rather than by six
 * unrelated hues. The hue carries no meaning — two zones differ only in which
 * area they are — so cycling through orange/green/teal/blue implied a
 * categorical difference that does not exist, and none of those values came
 * from a shared token.
 *
 * Steps are Tailwind's `violet` scale, the same one `--violet` sits on.
 */
const palette = [
  { fill: '#F5F3FF', stroke: '#7C3AED' }, // violet-50 / 600
  { fill: '#EDE9FE', stroke: '#6D28D9' }, // violet-100 / 700
  { fill: '#F5F3FF', stroke: '#8B5CF6' }, // violet-50 / 500
  { fill: '#EDE9FE', stroke: '#5B21B6' }, // violet-100 / 800
  { fill: '#F5F3FF', stroke: '#A78BFA' }, // violet-50 / 400
  { fill: '#EDE9FE', stroke: '#4C1D95' }, // violet-100 / 900
];

const overviewPalette = [
  { stroke: '#7C3AED', fill: 'rgba(124,58,237,.035)' },
  { stroke: '#159461', fill: 'rgba(21,148,97,.045)' },
  { stroke: '#E47B00', fill: 'rgba(228,123,0,.045)' },
  { stroke: '#3281C8', fill: 'rgba(50,129,200,.045)' },
];

/**
 * Booth status. These mirror the `emerald` / `danger` / `amber` / `muted`
 * tokens in `tailwind.config.ts`; SVG `fill` cannot take a Tailwind class, so
 * the values are repeated here and must be changed in both places together.
 */
const status = {
  available: { fill: '#ffffff', stroke: '#7C3AED', text: '#6D28D9' },
  held: { fill: '#FFF7E6', stroke: '#F59E0B', text: '#8a5a00' }, // amber / amber-bg
  booked: { fill: '#2C8B61', stroke: '#247A56', text: '#ffffff' },
  disabled: { fill: '#F3F4F6', stroke: '#9ca3af', text: '#6b7280' }, // muted
} as const;

const STATUS_LEGEND = [
  { key: 'available', label: 'ว่าง' },
  { key: 'held', label: 'กำลังถูกจอง' },
  { key: 'booked', label: 'ไม่ว่าง' },
  { key: 'disabled', label: 'ปิดใช้งาน' },
] as const;

function statusOf(booth: EventBooth) {
  if (booth.availability === 'BOOKED') return status.booked;
  if (booth.availability === 'HELD') return status.held;
  if (booth.availability === 'UNAVAILABLE') return status.disabled;
  return status.available;
}

/**
 * The zone code sits in a pill sized to its text rather than a fixed-radius
 * circle. Real data includes codes far longer than the circle assumed — "Phase
 * 6 Test Zone" rendered as "HASE" — and an SVG circle cannot grow to fit.
 * Width is estimated from character count because SVG has no intrinsic layout.
 */
function pillWidth(text: string, fontSize: number) {
  return Math.max(fontSize * 1.6, text.length * fontSize * 0.62 + fontSize);
}

type ZoneMapProps = {
  readOnly?: boolean;
  keepOverview?: boolean;
  showLegend?: boolean;
  multiSelect?: boolean;
  boothHref?: (booth: EventBooth) => string;
  mapImageUrl?: string | null;
  zones: EventZone[];
  focusedZoneId: string | null;
  selectedBoothIds: string[];
  recommendedBoothId: string | null;
  onFocusZone: (zoneId: string) => void;
  onSelectBooth: (booth: EventBooth) => void;
};

function boothFill(
  booth: EventBooth,
  selectedBoothIds: string[],
  recommendedBoothId: string | null,
) {
  if (selectedBoothIds.includes(booth.id)) return '#201B2E';
  if (booth.id === recommendedBoothId) return '#7C3AED';
  return statusOf(booth).fill;
}

function boothStroke(booth: EventBooth) {
  return statusOf(booth).stroke;
}

function boothText(
  booth: EventBooth,
  selectedBoothIds: string[],
  recommendedBoothId: string | null,
) {
  if (
    selectedBoothIds.includes(booth.id) ||
    booth.id === recommendedBoothId
  ) {
    return '#ffffff';
  }
  return statusOf(booth).text;
}

function bookedLogoUrl(booth: EventBooth) {
  if (booth.availability !== 'BOOKED') return null;
  return booth.occupant?.logoUrl ?? null;
}

function BookedShopLogo({ logoUrl, shopName }: { logoUrl: string | null; shopName: string }) {
  const [imageFailed, setImageFailed] = useState(false);

  if (!logoUrl || imageFailed) {
    return (
      <span className="grid h-full w-full place-items-center bg-[linear-gradient(135deg,#31a66f,#0f3f2d)] text-lg font-black text-white" aria-hidden>
        {shopName.trim().charAt(0) || 'ร'}
      </span>
    );
  }

  return (
    <Image
      src={logoUrl}
      alt={`โลโก้ร้าน ${shopName}`}
      fill
      unoptimized
      sizes="(max-width: 768px) 33vw, 140px"
      className="object-cover"
      onError={() => setImageFailed(true)}
    />
  );
}

const tierColor = {
  S: '#4c1d95',
  A: '#6d28d9',
  B: '#8b5cf6',
  C: '#c4b5fd',
} as const;

function positionedCoordinate(
  rawValue: string | null,
  min: number,
  max: number,
  itemSize: number,
  fallback: number,
) {
  if (rawValue === null) return fallback;
  const value = Number(rawValue);
  if (!Number.isFinite(value)) return fallback;

  const span = max - min - itemSize;
  if (value >= 0 && value <= 1) return min + value * span;
  if (value >= 0 && value <= 100) return min + (value / 100) * span;
  return Math.min(Math.max(value, min), max - itemSize);
}

export function ZoneMap({
  readOnly = false,
  keepOverview = false,
  showLegend = true,
  multiSelect = false,
  boothHref,
  mapImageUrl,
  zones,
  focusedZoneId,
  selectedBoothIds,
  recommendedBoothId,
  onFocusZone,
  onSelectBooth,
}: ZoneMapProps) {
  const visibleZones = useMemo(
    () =>
      focusedZoneId && !keepOverview
        ? zones.filter((zone) => zone.id === focusedZoneId)
        : zones,
    [focusedZoneId, keepOverview, zones],
  );

  const rows = Math.max(1, Math.ceil(visibleZones.length / 2));
  const focusedRows = Math.max(
    1,
    Math.ceil((visibleZones[0]?.booths.length ?? 0) / 6),
  );
  const focusedView = Boolean(focusedZoneId && !keepOverview);
  const viewHeight = focusedView
    ? Math.max(650, 285 + focusedRows * 92)
    : rows * 300 + 100;

  if (keepOverview) {
    return (
      <OverviewGridMap
        zones={zones}
        readOnly={readOnly}
        focusedZoneId={focusedZoneId}
        selectedBoothIds={selectedBoothIds}
        recommendedBoothId={recommendedBoothId}
        multiSelect={multiSelect}
        boothHref={boothHref}
        onFocusZone={onFocusZone}
        onSelectBooth={onSelectBooth}
      />
    );
  }

  return (
    <div className="overflow-hidden rounded-[28px] border border-[#ded6eb] bg-white shadow-[0_20px_55px_rgba(54,36,91,0.09)]">
      <svg
        viewBox={`0 0 1000 ${viewHeight}`}
        className="block h-auto min-h-[420px] w-full"
        role="img"
        aria-label={
          focusedZoneId ? 'แผนผังบูธในโซนที่เลือก' : 'แผนผังภาพรวมทุกโซนของงาน'
        }
      >
        <defs>
          <pattern
            id="walkway"
            width="24"
            height="24"
            patternUnits="userSpaceOnUse"
          >
            <path d="M0 12h24" stroke="#E9E6F0" strokeWidth="1" />
          </pattern>
          <filter id="mapShadow" x="-10%" y="-10%" width="120%" height="125%">
            <feDropShadow dx="0" dy="8" stdDeviation="8" floodOpacity=".09" />
          </filter>
        </defs>

        <rect width="100%" height="100%" fill="#f9f7fd" />
        {mapImageUrl && (
          <image
            href={mapImageUrl}
            x="0"
            y="58"
            width="1000"
            height={viewHeight - 118}
            preserveAspectRatio="xMidYMid slice"
            opacity="0.3"
          />
        )}
        <rect x="0" y="0" width="1000" height="58" fill="#5B21B6" />
        <text
          x="500"
          y="37"
          textAnchor="middle"
          fill="white"
          fontSize="20"
          fontWeight="800"
        >
          ทางเข้า • จุดลงทะเบียน
        </text>

        {focusedView ? (
          <FocusedZone
            zone={visibleZones[0]}
            readOnly={readOnly}
            viewHeight={viewHeight}
            color={
              palette[
                Math.max(
                  0,
                  zones.findIndex((zone) => zone.id === focusedZoneId),
                ) % palette.length
              ]
            }
            selectedBoothIds={selectedBoothIds}
            recommendedBoothId={recommendedBoothId}
            onSelectBooth={onSelectBooth}
          />
        ) : (
          visibleZones.map((zone, index) => {
            const column = index % 2;
            const row = Math.floor(index / 2);
            const x = column === 0 ? 55 : 535;
            const y = 88 + row * 300;

            return (
              <OverviewZone
                key={zone.id}
                zone={zone}
                x={x}
                y={y}
                color={palette[index % palette.length]}
                selected={focusedZoneId === zone.id}
                readOnly={readOnly}
                selectedBoothIds={selectedBoothIds}
                recommendedBoothId={recommendedBoothId}
                multiSelect={multiSelect}
                boothHref={boothHref}
                onFocusZone={onFocusZone}
                onSelectBooth={onSelectBooth}
              />
            );
          })
        )}

        {!focusedView && visibleZones.length > 1 && (
          <g>
            <rect
              x="480"
              y="58"
              width="40"
              height={viewHeight - 118}
              fill="url(#walkway)"
            />
            <text
              x="500"
              y={viewHeight / 2}
              textAnchor="middle"
              fill="#726B80"
              fontSize="14"
              fontWeight="700"
              transform={`rotate(90 500 ${viewHeight / 2})`}
            >
              ทางเดินกลาง
            </text>
          </g>
        )}

        <rect
          x="0"
          y={viewHeight - 60}
          width="1000"
          height="60"
          fill="#4B4557"
        />
        <text
          x="500"
          y={viewHeight - 23}
          textAnchor="middle"
          fill="white"
          fontSize="18"
          fontWeight="800"
        >
          ทางออก • จุดรับส่ง
        </text>
      </svg>

      {showLegend && <MapLegend />}
    </div>
  );
}

function OverviewGridMap({
  zones,
  readOnly,
  focusedZoneId,
  selectedBoothIds,
  recommendedBoothId,
  multiSelect,
  boothHref,
  onFocusZone,
  onSelectBooth,
}: {
  zones: EventZone[];
  readOnly: boolean;
  focusedZoneId: string | null;
  selectedBoothIds: string[];
  recommendedBoothId: string | null;
  multiSelect: boolean;
  boothHref?: (booth: EventBooth) => string;
  onFocusZone: (zoneId: string) => void;
  onSelectBooth: (booth: EventBooth) => void;
}) {
  const [selectedShop, setSelectedShop] = useState<{ booth: EventBooth; zone: EventZone } | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const openerRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!selectedShop) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeButtonRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setSelectedShop(null);
        return;
      }

      if (event.key !== 'Tab') return;

      const focusableElements = Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      ).filter((element) => !element.hasAttribute('hidden'));

      if (focusableElements.length === 0) {
        event.preventDefault();
        dialogRef.current?.focus();
        return;
      }

      const first = focusableElements[0];
      const last = focusableElements[focusableElements.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
      openerRef.current?.focus();
    };
  }, [selectedShop]);

  return (
    <>
      <div
        className="grid grid-cols-1 items-start gap-3 overflow-hidden bg-[#fcfbff] p-4 md:grid-cols-2 xl:grid-cols-3"
        style={{
          backgroundImage:
            'linear-gradient(#e9e4ef 1px,transparent 1px),linear-gradient(90deg,#e9e4ef 1px,transparent 1px)',
          backgroundSize: '38px 38px',
        }}
      >
        {zones.map((zone, zoneIndex) => {
        const tone = overviewPalette[zoneIndex % overviewPalette.length];
        const available = zone.booths.filter(
          (booth) => booth.availability === 'AVAILABLE',
        ).length;
        const selected = zone.id === focusedZoneId;

        return (
          <section
            key={zone.id}
            aria-label={`Zone ${zone.code} ${zone.name ?? ''}`}
            onClick={() => onFocusZone(zone.id)}
            className={`rounded-[20px] border-2 border-dashed p-3 transition ${
              selected
                ? 'shadow-[0_0_0_5px_rgba(124,58,237,.10),0_16px_34px_rgba(54,36,91,.10)]'
                : 'hover:-translate-y-0.5 hover:shadow-soft'
            }`}
            style={{ borderColor: tone.stroke, backgroundColor: tone.fill }}
          >
            <div className="mb-2 flex items-start justify-between gap-2">
              <div>
                <h2 className="text-sm font-black text-ink">Zone {zone.code}</h2>
                <p className="mt-0.5 line-clamp-1 text-sm text-muted">
                  {zone.name ??
                    (zone.categories
                      .map((category) => category.name)
                      .join(' · ') || 'ยังไม่ระบุชื่อโซน')}
                </p>
              </div>
              <span className="rounded-full bg-[#e9f9f1] px-2 py-1 text-xs font-extrabold text-[#128252]">
                {available} ว่าง
              </span>
            </div>

            <div className="grid grid-cols-3 gap-1">
              {zone.booths.map((booth) => {
                const unavailable = booth.availability !== 'AVAILABLE';
                const href =
                  !multiSelect && !readOnly && !unavailable
                    ? boothHref?.(booth)
                    : undefined;
                const selected = selectedBoothIds.includes(booth.id);
                const recommended = booth.id === recommendedBoothId;
                const shopName = booth.occupant?.name ?? 'จองแล้ว';
                const shared =
                  'relative flex min-h-[38px] flex-col items-center justify-center overflow-hidden rounded-[9px] border px-1 py-1 text-center transition';

                if (booth.availability === 'BOOKED') {
                  return (
                    <button
                      key={booth.id}
                      type="button"
                      aria-label={`ดูข้อมูลร้าน ${shopName} ที่บูธ ${booth.code}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        openerRef.current = event.currentTarget;
                        setSelectedShop({ booth, zone });
                      }}
                      className={`${shared} border-[#2a9b67] bg-white p-0 text-white hover:-translate-y-0.5 hover:border-[#168555] hover:shadow-[0_9px_20px_rgba(15,63,45,.2)] focus:outline-none focus:ring-2 focus:ring-[#168555] focus:ring-offset-2`}
                    >
                      <BookedShopLogo logoUrl={booth.occupant?.logoUrl ?? null} shopName={shopName} />
                    </button>
                  );
                }

                if (booth.availability === 'HELD') {
                  return (
                    <div key={booth.id} aria-label={`บูธ ${booth.code} กำลังถูกจอง`} className={`${shared} cursor-not-allowed border-[#e7a339] bg-[#fff8ec] text-[#9d620c]`}>
                      <strong className="text-sm">{booth.code}</strong>
                      <span className="text-xs">กำลังจอง</span>
                    </div>
                  );
                }

                if (booth.availability === 'UNAVAILABLE') {
                  return (
                    <div key={booth.id} aria-label={`บูธ ${booth.code} ปิดใช้งาน`} className={`${shared} cursor-not-allowed border-dashed border-[#d3ccd6] bg-[#efedef] text-[#918996]`}>
                      <strong className="text-sm">{booth.code}</strong>
                      <span className="text-xs">ปิดใช้งาน</span>
                    </div>
                  );
                }

                if (href) {
                  return (
                    <a
                      key={booth.id}
                      href={href}
                      aria-label={`บูธ ${booth.code} AVAILABLE`}
                      onClick={(event) => event.stopPropagation()}
                      className={`${shared} border-[#7c3aed] bg-white text-[#6d28d9] hover:-translate-y-1 hover:bg-[#faf7ff] hover:shadow-[0_10px_22px_rgba(109,40,217,.13)] ${recommended ? 'ring-2 ring-[#7c3aed] ring-offset-2 shadow-[0_0_0_5px_rgba(124,58,237,.12)]' : ''}`}
                    >
                      {recommended ? <span className="absolute right-1 top-1 rounded-full bg-violet px-1.5 py-0.5 text-xs font-black leading-none text-white">AI</span> : null}
                      <strong className="text-sm">{booth.code}</strong>
                    </a>
                  );
                }

                return (
                  <button
                    key={booth.id}
                    type="button"
                    disabled={readOnly}
                    aria-pressed={selected}
                    aria-label={`บูธ ${booth.code} AVAILABLE`}
                    onClick={(event) => {
                      event.stopPropagation();
                      onSelectBooth(booth);
                    }}
                    className={`${shared} ${selected ? 'border-[#201b2e] bg-[#201b2e] text-white shadow-[0_9px_20px_rgba(32,27,46,.2)]' : 'border-[#7c3aed] bg-white text-[#6d28d9] hover:-translate-y-1 hover:bg-[#faf7ff] hover:shadow-[0_10px_22px_rgba(109,40,217,.13)]'} ${recommended ? 'ring-2 ring-[#7c3aed] ring-offset-2 shadow-[0_0_0_5px_rgba(124,58,237,.12)]' : ''}`}
                  >
                    {recommended ? <span className="absolute right-1 top-1 rounded-full bg-violet px-1.5 py-0.5 text-xs font-black leading-none text-white">AI</span> : null}
                    <strong className="text-sm">{booth.code}</strong>
                  </button>
                );
              })}
            </div>
          </section>
        );
        })}
      </div>

      {selectedShop ? (
        <div
          className="fixed inset-0 z-[95] grid place-items-center bg-[#160f23]/55 p-4 backdrop-blur-[3px]"
          onClick={() => setSelectedShop(null)}
        >
          <section
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="booked-shop-title"
            tabIndex={-1}
            onClick={(event) => event.stopPropagation()}
            className="w-full max-w-[460px] overflow-hidden rounded-[26px] border border-[#e4dcef] bg-white shadow-[0_28px_90px_rgba(30,18,52,.32)]"
          >
            <div className="flex items-start gap-4 border-b border-line p-5">
              <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-[18px] border border-[#d9cfeb] bg-[#f7f2ff]">
                <BookedShopLogo logoUrl={selectedShop.booth.occupant?.logoUrl ?? null} shopName={selectedShop.booth.occupant?.name ?? 'ร้านค้า'} />
              </div>
              <div className="min-w-0 flex-1 pt-1">
                <span className="sl-kicker">SHOP INFORMATION</span>
                <h2 id="booked-shop-title" className="mt-1 truncate text-xl font-black text-ink">
                  {selectedShop.booth.occupant?.name ?? 'ร้านค้าที่จองพื้นที่'}
                </h2>
                <p className="mt-1 text-sm text-muted">Zone {selectedShop.zone.code} · Booth {selectedShop.booth.code}</p>
              </div>
              <button
                ref={closeButtonRef}
                type="button"
                aria-label="ปิดข้อมูลร้านค้า"
                onClick={() => setSelectedShop(null)}
                className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-line text-xl text-muted transition hover:border-violet hover:text-violet"
              >
                ×
              </button>
            </div>

            <div className="p-5">
              <h3 className="text-base font-black text-ink">ร้านนี้จำหน่ายอะไร?</h3>
              {selectedShop.zone.categories.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {selectedShop.zone.categories.map((category) => (
                    <span key={category.id} className="rounded-full border border-[#d9c9f2] bg-[#f8f3ff] px-3 py-2 text-sm font-bold text-violet">
                      {category.name}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-sm text-muted">ร้านค้ายังไม่ได้ระบุหมวดสินค้าในข้อมูลสาธารณะ</p>
              )}
              <p className="mt-4 rounded-[14px] bg-[#f7f5fa] p-3 text-sm leading-6 text-muted">
                หมวดสินค้านี้อ้างอิงจากประเภทสินค้าที่ผู้จัดงานกำหนดให้ Zone {selectedShop.zone.code}
              </p>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}

/**
 * Always visible, on both the overview and the focused view. The booth colours
 * are the only thing distinguishing a bookable booth from one that is held or
 * already taken, and until now the full map explained them nowhere.
 */
function MapLegend() {
  return (
    <ul className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-line bg-white/95 px-5 py-4">
      {STATUS_LEGEND.map(({ key, label }) => (
        <li key={key} className="flex items-center gap-2 text-xs font-semibold text-muted">
          <span
            aria-hidden
            className="h-3 w-3 shrink-0 rounded-[4px] border"
            style={{
              backgroundColor: status[key].fill,
              borderColor: status[key].stroke,
            }}
          />
          {label}
        </li>
      ))}
    </ul>
  );
}

function OverviewZone({
  zone,
  x,
  y,
  color,
  selected,
  readOnly,
  selectedBoothIds,
  recommendedBoothId,
  multiSelect,
  boothHref,
  onFocusZone,
  onSelectBooth,
}: {
  zone: EventZone;
  x: number;
  y: number;
  color: (typeof palette)[number];
  selected: boolean;
  readOnly: boolean;
  selectedBoothIds: string[];
  recommendedBoothId: string | null;
  multiSelect: boolean;
  boothHref?: (booth: EventBooth) => string;
  onFocusZone: (zoneId: string) => void;
  onSelectBooth: (booth: EventBooth) => void;
}) {
  const available = zone.booths.filter(
    (booth) => booth.availability === 'AVAILABLE',
  ).length;

  return (
    <g
      role="button"
      tabIndex={0}
      aria-label={`เปิด ${zone.name ?? `โซน ${zone.code}`} มี ${available} บูธว่าง`}
      onClick={() => onFocusZone(zone.id)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') onFocusZone(zone.id);
      }}
      className="cursor-pointer focus:outline-none focus:ring-2 focus:ring-violet focus:ring-offset-2"
    >
      <title>
        {`${zone.name ?? `โซน ${zone.code}`} รองรับ ${
          zone.categories.map((category) => category.name).join(', ') ||
          'สินค้าตามที่ผู้จัดกำหนด'
        } มี ${available} บูธว่าง`}
      </title>
      <rect
        x={x}
        y={y}
        width="410"
        height="245"
        rx="24"
        fill={color.fill}
        fillOpacity="0.9"
        stroke={color.stroke}
        strokeWidth={selected ? 5 : 2}
        filter="url(#mapShadow)"
      />
      <rect
        x={x + 18}
        y={y + 20}
        width={pillWidth(zone.code, 18)}
        height="32"
        rx="16"
        fill={color.stroke}
      />
      <text
        x={x + 18 + pillWidth(zone.code, 18) / 2}
        y={y + 41}
        textAnchor="middle"
        fill="white"
        fontSize="16"
        fontWeight="900"
      >
        {zone.code}
      </text>
      <text
        x={x + 30 + pillWidth(zone.code, 18)}
        y={y + 41}
        fill={color.stroke}
        fontSize="19"
        fontWeight="900"
      >
        {zone.name ?? `โซน ${zone.code}`}
      </text>
      <text x={x + 20} y={y + 74} fill="#726B80" fontSize="13">
        {available} บูธว่าง • คลิกเพื่อดูพื้นที่
      </text>

      {zone.booths.slice(0, 12).map((booth, index) => {
        const boothX = x + 28 + (index % 6) * 59;
        const boothY = y + 92 + Math.floor(index / 6) * 54;
        const logoUrl = bookedLogoUrl(booth);
        const clipId = `overview-logo-${booth.id}`;

        const unavailable = booth.availability !== 'AVAILABLE';
        const href =
          !multiSelect && !readOnly && !unavailable
            ? boothHref?.(booth)
            : undefined;

        return (
          <a
            key={booth.id}
            href={href}
            role={href ? 'link' : readOnly ? undefined : 'button'}
            tabIndex={readOnly || unavailable ? -1 : 0}
            aria-disabled={unavailable}
            aria-label={readOnly ? undefined : `บูธ ${booth.code} ${booth.availability}`}
            onClick={(event) => {
              event.stopPropagation();
              if (!href && !readOnly && !unavailable) onSelectBooth(booth);
            }}
            onKeyDown={(event) => {
              if (!readOnly && !unavailable && (event.key === 'Enter' || event.key === ' ')) {
                event.stopPropagation();
                onSelectBooth(booth);
              }
            }}
            className={readOnly ? undefined : unavailable ? 'cursor-not-allowed' : 'cursor-pointer'}
          >
            <rect
              x={boothX}
              y={boothY}
              width="49"
              height="38"
              rx="7"
              fill={boothFill(booth, selectedBoothIds, recommendedBoothId)}
              stroke={boothStroke(booth)}
              strokeWidth="2"
            />
            {logoUrl ? (
              <>
                <defs>
                  <clipPath id={clipId}>
                    <rect x={boothX} y={boothY} width="49" height="38" rx="7" />
                  </clipPath>
                </defs>
                <image
                  href={logoUrl}
                  x={boothX}
                  y={boothY}
                  width="49"
                  height="38"
                  preserveAspectRatio="xMidYMid slice"
                  clipPath={`url(#${clipId})`}
                />
              </>
            ) : booth.tier ? (
              <g>
                <circle
                  cx={boothX + 43}
                  cy={boothY + 6}
                  r="9"
                  fill={tierColor[booth.tier]}
                />
                <text
                  x={boothX + 43}
                  y={boothY + 10}
                  textAnchor="middle"
                  fill="white"
                  fontSize="9"
                  fontWeight="900"
                >
                  {booth.tier}
                </text>
              </g>
            ) : null}
            {!logoUrl && (
              <text
                x={boothX + 24.5}
                y={boothY + 24}
                textAnchor="middle"
                fill={boothText(booth, selectedBoothIds, recommendedBoothId)}
                fontSize="11"
                fontWeight="800"
              >
                {booth.code}
              </text>
            )}
          </a>
        );
      })}
    </g>
  );
}

function FocusedZone({
  zone,
  readOnly,
  viewHeight,
  color,
  selectedBoothIds,
  recommendedBoothId,
  onSelectBooth,
}: {
  zone: EventZone | undefined;
  readOnly: boolean;
  viewHeight: number;
  color: (typeof palette)[number];
  selectedBoothIds: string[];
  recommendedBoothId: string | null;
  onSelectBooth: (booth: EventBooth) => void;
}) {
  if (!zone) return null;

  const columns = 6;
  const boothWidth = 112;
  const boothHeight = 68;
  const gapX = 20;
  const gapY = 24;

  return (
    <g>
      <rect
        x="55"
        y="88"
        width="890"
        height={viewHeight - 168}
        rx="30"
        fill={color.fill}
        fillOpacity="0.9"
        stroke={color.stroke}
        strokeWidth="3"
        filter="url(#mapShadow)"
      />
      <rect
        x="80"
        y="112"
        width={pillWidth(zone.code, 24)}
        height="42"
        rx="21"
        fill={color.stroke}
      />
      <text
        x={80 + pillWidth(zone.code, 24) / 2}
        y="140"
        textAnchor="middle"
        fill="white"
        fontSize="21"
        fontWeight="900"
      >
        {zone.code}
      </text>
      <text
        x={96 + pillWidth(zone.code, 24)}
        y="134"
        fill={color.stroke}
        fontSize="26"
        fontWeight="900"
      >
        {zone.name ?? `โซน ${zone.code}`}
      </text>
      <text x={96 + pillWidth(zone.code, 24)} y="160" fill="#726B80" fontSize="15">
        {zone.description ??
          zone.categories.map((category) => category.name).join(' • ')}
      </text>

      {zone.booths.map((booth, index) => {
        const fallbackX = 94 + (index % columns) * (boothWidth + gapX);
        const fallbackY =
          205 + Math.floor(index / columns) * (boothHeight + gapY);
        const x = positionedCoordinate(
          booth.posX,
          75,
          925,
          boothWidth,
          fallbackX,
        );
        const y = positionedCoordinate(
          booth.posY,
          190,
          viewHeight - 80,
          boothHeight,
          fallbackY,
        );
        const unavailable = booth.availability !== 'AVAILABLE';
        const fill = boothFill(booth, selectedBoothIds, recommendedBoothId);
        const logoUrl = bookedLogoUrl(booth);
        const clipId = `focused-logo-${booth.id}`;

        return (
          <g
            key={booth.id}
            role={readOnly ? undefined : 'button'}
            tabIndex={readOnly || unavailable ? -1 : 0}
            aria-disabled={unavailable}
            aria-label={
              readOnly ? undefined : `บูธ ${booth.code} ${booth.availability}`
            }
            onClick={(event) => {
              event.stopPropagation();
              if (!readOnly && !unavailable) onSelectBooth(booth);
            }}
            onKeyDown={(event) => {
              if (
                !readOnly &&
                !unavailable &&
                (event.key === 'Enter' || event.key === ' ')
              ) {
                onSelectBooth(booth);
              }
            }}
            className={
              readOnly
                ? undefined
                : unavailable
                  ? 'cursor-not-allowed'
                  : 'cursor-pointer focus:outline-none focus:ring-2 focus:ring-violet focus:ring-offset-2'
            }
          >
            <title>
              {`บูธ ${booth.code} · ${booth.availability} · ${
                zone.categories.map((category) => category.name).join(', ') ||
                'สินค้าตามที่ผู้จัดกำหนด'
              }`}
            </title>
            {booth.id === recommendedBoothId && (
              <rect
                x={x - 6}
                y={y - 6}
                width={boothWidth + 12}
                height={boothHeight + 12}
                rx="15"
                fill="none"
                stroke="#7C3AED"
                strokeWidth="4"
                strokeDasharray="8 5"
              />
            )}
            <rect
              x={x}
              y={y}
              width={boothWidth}
              height={boothHeight}
              rx="11"
              fill={fill}
              stroke={boothStroke(booth)}
              strokeWidth="4"
              opacity={unavailable ? 0.72 : 1}
            />
            {logoUrl ? (
              <>
                <defs>
                  <clipPath id={clipId}>
                    <rect
                      x={x}
                      y={y}
                      width={boothWidth}
                      height={boothHeight}
                      rx="11"
                    />
                  </clipPath>
                </defs>
                <image
                  href={logoUrl}
                  x={x}
                  y={y}
                  width={boothWidth}
                  height={boothHeight}
                  preserveAspectRatio="xMidYMid slice"
                  clipPath={`url(#${clipId})`}
                />
              </>
            ) : booth.tier ? (
              <g>
                <rect
                  x={x + boothWidth - 28}
                  y={y}
                  width="28"
                  height="23"
                  rx="8"
                  fill={tierColor[booth.tier]}
                />
                <text
                  x={x + boothWidth - 14}
                  y={y + 16}
                  textAnchor="middle"
                  fill="white"
                  fontSize="12"
                  fontWeight="900"
                >
                  {booth.tier}
                </text>
              </g>
            ) : null}
            {!logoUrl && (
              <text
                x={x + boothWidth / 2}
                y={booth.availability === 'AVAILABLE' ? y + boothHeight / 2 + 6 : y + 29}
                textAnchor="middle"
                fill={boothText(booth, selectedBoothIds, recommendedBoothId)}
                fontSize="17"
                fontWeight="900"
              >
                {booth.code}
              </text>
            )}
            {booth.availability !== 'AVAILABLE' ? (
              <text
                x={x + boothWidth / 2}
                y={y + 50}
                textAnchor="middle"
                fill={boothText(booth, selectedBoothIds, recommendedBoothId)}
                fontSize="12"
                opacity="0.86"
              >
                {booth.availability === 'HELD'
                  ? 'กำลังถูกจอง'
                  : booth.availability === 'BOOKED'
                    ? 'ไม่ว่าง'
                    : 'ปิดใช้งาน'}
              </text>
            ) : null}
          </g>
        );
      })}
    </g>
  );
}
