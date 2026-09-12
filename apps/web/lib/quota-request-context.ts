import type { EventMap, MyBooking } from './api';

export type QuotaRequestQuery = {
  eventId: string;
  zoneId: string;
  boothId: string;
};

export type ParsedQuotaRequestQuery =
  | { status: 'none' }
  | { status: 'invalid'; message: string }
  | { status: 'ready'; value: QuotaRequestQuery };

export type QuotaRequestOption = {
  key: string;
  eventId: string;
  eventName: string;
  zoneId: string;
  zoneName: string;
  source: 'context';
};

export type QuotaBoothOption = {
  id: string;
  code: string;
  widthM: string | null;
  heightM: string | null;
};

export type ResolvedQuotaRequestContext =
  | { status: 'error'; message: string }
  | {
      status: 'ready';
      option: QuotaRequestOption;
      booths: QuotaBoothOption[];
      requestedBoothId: string;
      notice: string | null;
    };

type QueryReader = { get(name: string): string | null };

export function parseQuotaRequestQuery(
  params: QueryReader,
): ParsedQuotaRequestQuery {
  if (params.get('type') !== 'QUOTA_INCREASE') return { status: 'none' };

  const eventId = params.get('eventId')?.trim() ?? '';
  const zoneId = params.get('zoneId')?.trim() ?? '';
  const boothId = params.get('boothId')?.trim() ?? '';
  if (!eventId || !zoneId || !boothId) {
    return {
      status: 'invalid',
      message: 'ลิงก์คำขอโควตาไม่ครบ กรุณากลับไปเลือกบูธจากหน้าแผนผังอีกครั้ง',
    };
  }

  return { status: 'ready', value: { eventId, zoneId, boothId } };
}

export function resolveQuotaRequestContext({
  query,
  eventMap,
  bookings,
}: {
  query: QuotaRequestQuery;
  eventMap: EventMap;
  bookings: MyBooking[];
}): ResolvedQuotaRequestContext {
  if (eventMap.event.id !== query.eventId) {
    return { status: 'error', message: 'ไม่พบ Event ตามลิงก์คำขอโควตา' };
  }

  const hasActiveBookingInEvent = bookings.some(
    (booking) =>
      booking.event.id === query.eventId &&
      (booking.status === 'PENDING_PAYMENT' || booking.status === 'CONFIRMED'),
  );
  if (!hasActiveBookingInEvent) {
    return {
      status: 'error',
      message: 'ต้องมีการจองที่ใช้งานอยู่ใน Event นี้ก่อนส่งคำขอเพิ่มโควตา',
    };
  }

  const zone = eventMap.zones.find((candidate) => candidate.id === query.zoneId);
  if (!zone) {
    return { status: 'error', message: 'ไม่พบ Zone ตามลิงก์คำขอโควตา' };
  }

  const requestedBooth = zone.booths.find(
    (candidate) => candidate.id === query.boothId,
  );
  if (!requestedBooth) {
    return {
      status: 'error',
      message: 'บูธตามลิงก์ไม่ได้อยู่ใน Zone ที่ระบุ กรุณาเลือกใหม่จากแผนผัง',
    };
  }

  const booths = zone.booths
    .filter((booth) => booth.availability === 'AVAILABLE')
    .map((booth) => ({
      id: booth.id,
      code: booth.code,
      widthM: booth.widthM,
      heightM: booth.heightM,
    }));
  const available = requestedBooth.availability === 'AVAILABLE';

  return {
    status: 'ready',
    option: {
      key: `${eventMap.event.id}:${zone.id}`,
      eventId: eventMap.event.id,
      eventName: eventMap.event.name,
      zoneId: zone.id,
      zoneName: zone.name ?? zone.code,
      source: 'context',
    },
    booths,
    requestedBoothId: available ? requestedBooth.id : '',
    notice: available
      ? null
      : `บูธ ${requestedBooth.code} ไม่ว่างแล้ว กรุณาเลือกบูธอื่น`,
  };
}
