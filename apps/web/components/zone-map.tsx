'use client';

import { useMemo } from 'react';
import type { EventBooth, EventZone } from '@/lib/api';

const palette = [
  { fill: '#fff2e8', stroke: '#e87722', booth: '#e87722' },
  { fill: '#eef8ec', stroke: '#3f8f45', booth: '#3f8f45' },
  { fill: '#eaf6f5', stroke: '#25877c', booth: '#25877c' },
  { fill: '#f4edff', stroke: '#7652b4', booth: '#7652b4' },
  { fill: '#eaf3ff', stroke: '#3976b9', booth: '#3976b9' },
  { fill: '#fff0f4', stroke: '#bb5274', booth: '#bb5274' },
];

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
  zoneColor: string,
) {
  if (booth.id === selectedBoothId) return '#17152a';
  if (booth.id === recommendedBoothId) return '#6d3ce8';
  if (booth.availability === 'BOOKED') return '#ef8179';
  if (booth.availability === 'HELD') return '#f4ce58';
  if (booth.availability === 'UNAVAILABLE') return '#b7b4bd';
  return zoneColor;
}

function boothStroke(booth: EventBooth) {
  if (booth.availability === 'BOOKED') return '#dc2626';
  if (booth.availability === 'HELD') return '#ca8a04';
  if (booth.availability === 'UNAVAILABLE') return '#6b7280';
  return '#15803d';
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
    <div className="overflow-hidden rounded-[28px] border border-[#ded9e7] bg-[#f3f0e9]">
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
            <path d="M0 12h24" stroke="#d8d2c8" strokeWidth="1" />
          </pattern>
          <filter id="mapShadow" x="-10%" y="-10%" width="120%" height="125%">
            <feDropShadow dx="0" dy="8" stdDeviation="8" floodOpacity=".09" />
          </filter>
        </defs>

        <rect width="100%" height="100%" fill="#f6f3ed" />
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
        <rect x="0" y="0" width="1000" height="58" fill="#205f48" />
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
              fill="#6f695f"
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
          fill="#3c617d"
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
    </div>
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
      className="cursor-pointer outline-none"
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
        strokeDasharray="7 5"
        filter="url(#mapShadow)"
      />
      <circle cx={x + 38} cy={y + 38} r="23" fill={color.stroke} />
      <text
        x={x + 38}
        y={y + 45}
        textAnchor="middle"
        fill="white"
        fontSize="20"
        fontWeight="900"
      >
        {zone.code}
      </text>
      <text
        x={x + 74}
        y={y + 35}
        fill={color.stroke}
        fontSize="20"
        fontWeight="900"
      >
        {zone.name ?? `โซน ${zone.code}`}
      </text>
      <text x={x + 74} y={y + 58} fill="#736d7b" fontSize="13">
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
              fill={
                booth.availability === 'AVAILABLE'
                  ? color.booth
                  : booth.availability === 'HELD'
                    ? '#f4ce58'
                    : booth.availability === 'BOOKED'
                      ? '#ef8179'
                      : '#b7b4bd'
              }
              stroke={boothStroke(booth)}
              strokeWidth="3"
              opacity={booth.availability === 'AVAILABLE' ? 0.9 : 0.75}
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
              fill={booth.availability === 'HELD' ? '#5b4710' : 'white'}
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
      <circle cx="105" cy="138" r="30" fill={color.stroke} />
      <text
        x="105"
        y="148"
        textAnchor="middle"
        fill="white"
        fontSize="27"
        fontWeight="900"
      >
        {zone.code}
      </text>
      <text x="150" y="134" fill={color.stroke} fontSize="27" fontWeight="900">
        {zone.name ?? `โซน ${zone.code}`}
      </text>
      <text x="150" y="160" fill="#756e7e" fontSize="15">
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
        const fill = boothFill(
          booth,
          selectedBoothId,
          recommendedBoothId,
          color.booth,
        );

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
                  : 'cursor-pointer outline-none'
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
                stroke="#6d3ce8"
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
              fill={booth.availability === 'HELD' ? '#5b4710' : 'white'}
              fontSize="17"
              fontWeight="900"
            >
              {booth.code}
            </text>
            <text
              x={x + boothWidth / 2}
              y={y + 50}
              textAnchor="middle"
              fill={booth.availability === 'HELD' ? '#5b4710' : 'white'}
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
