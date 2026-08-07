'use client';

import { useMemo } from 'react';
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

/**
 * Booth status. These mirror the `emerald` / `danger` / `amber` / `muted`
 * tokens in `tailwind.config.ts`; SVG `fill` cannot take a Tailwind class, so
 * the values are repeated here and must be changed in both places together.
 */
const status = {
  available: { fill: '#13795b', stroke: '#0f5f47', text: '#ffffff' }, // emerald
  held: { fill: '#FFF7E6', stroke: '#F59E0B', text: '#8a5a00' }, // amber / amber-bg
  booked: { fill: '#FEF2F2', stroke: '#c62448', text: '#991b32' }, // danger / red-bg
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
  mapImageUrl?: string | null;
  zones: EventZone[];
  focusedZoneId: string | null;
  selectedBoothId: string | null;
  recommendedBoothId: string | null;
  onFocusZone: (zoneId: string) => void;
  onSelectBooth: (booth: EventBooth) => void;
};

function boothFill(
  booth: EventBooth,
  selectedBoothId: string | null,
  recommendedBoothId: string | null,
) {
  if (booth.id === selectedBoothId) return '#201B2E';
  if (booth.id === recommendedBoothId) return '#7C3AED';
  return statusOf(booth).fill;
}

function boothStroke(booth: EventBooth) {
  return statusOf(booth).stroke;
}

function boothText(
  booth: EventBooth,
  selectedBoothId: string | null,
  recommendedBoothId: string | null,
) {
  if (booth.id === selectedBoothId || booth.id === recommendedBoothId) {
    return '#ffffff';
  }
  return statusOf(booth).text;
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
  mapImageUrl,
  zones,
  focusedZoneId,
  selectedBoothId,
  recommendedBoothId,
  onFocusZone,
  onSelectBooth,
}: ZoneMapProps) {
  const visibleZones = useMemo(
    () =>
      focusedZoneId ? zones.filter((zone) => zone.id === focusedZoneId) : zones,
    [focusedZoneId, zones],
  );

  const rows = Math.max(1, Math.ceil(visibleZones.length / 2));
  const focusedRows = Math.max(
    1,
    Math.ceil((visibleZones[0]?.booths.length ?? 0) / 6),
  );
  const viewHeight = focusedZoneId
    ? Math.max(650, 285 + focusedRows * 92)
    : rows * 300 + 100;

  return (
    <div className="overflow-hidden rounded-[28px] border border-line bg-white shadow-soft">
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

        <rect width="100%" height="100%" fill="#f6f3ff" />
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

        {focusedZoneId ? (
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
            selectedBoothId={selectedBoothId}
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
                onFocusZone={onFocusZone}
              />
            );
          })
        )}

        {!focusedZoneId && visibleZones.length > 1 && (
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

      <MapLegend />
    </div>
  );
}

/**
 * Always visible, on both the overview and the focused view. The booth colours
 * are the only thing distinguishing a bookable booth from one that is held or
 * already taken, and until now the full map explained them nowhere.
 */
function MapLegend() {
  return (
    <ul className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-line px-5 py-3.5">
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
  onFocusZone,
}: {
  zone: EventZone;
  x: number;
  y: number;
  color: (typeof palette)[number];
  onFocusZone: (zoneId: string) => void;
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
        strokeWidth="2"
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

        return (
          <g key={booth.id}>
            <rect
              x={boothX}
              y={boothY}
              width="49"
              height="38"
              rx="7"
              fill={statusOf(booth).fill}
              stroke={boothStroke(booth)}
              strokeWidth="2"
            />
            {booth.tier && (
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
            )}
            <text
              x={boothX + 24.5}
              y={boothY + 24}
              textAnchor="middle"
              fill={statusOf(booth).text}
              fontSize="11"
              fontWeight="800"
            >
              {booth.code}
            </text>
          </g>
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
  selectedBoothId,
  recommendedBoothId,
  onSelectBooth,
}: {
  zone: EventZone | undefined;
  readOnly: boolean;
  viewHeight: number;
  color: (typeof palette)[number];
  selectedBoothId: string | null;
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
        const fill = boothFill(booth, selectedBoothId, recommendedBoothId);

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
            {booth.tier && (
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
            )}
            <text
              x={x + boothWidth / 2}
              y={y + 29}
              textAnchor="middle"
              fill={boothText(booth, selectedBoothId, recommendedBoothId)}
              fontSize="17"
              fontWeight="900"
            >
              {booth.code}
            </text>
            <text
              x={x + boothWidth / 2}
              y={y + 50}
              textAnchor="middle"
              fill={boothText(booth, selectedBoothId, recommendedBoothId)}
              fontSize="11"
              opacity="0.86"
            >
              {booth.availability === 'AVAILABLE'
                ? `${Number(booth.boothPrice).toLocaleString('th-TH')} บาท`
                : booth.availability === 'HELD'
                  ? 'กำลังถูกจอง'
                  : booth.availability === 'BOOKED'
                    ? 'ไม่ว่าง'
                    : 'ปิดใช้งาน'}
            </text>
          </g>
        );
      })}
    </g>
  );
}
