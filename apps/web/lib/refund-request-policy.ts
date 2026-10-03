import type { MyBooking, RefundRequest } from './api';

type RefundBooking = Pick<
  MyBooking,
  'id' | 'status' | 'isPaymentExempt' | 'confirmedAt'
>;

type RefundFlowBooking = RefundBooking & Pick<MyBooking, 'bookingEndDate'>;

export type RefundFlowAction = 'REQUEST' | 'CANCEL_AND_REQUEST';

export function refundFlowFailureMessage(
  failure: string,
  cancelledBoothCodes: string[],
): string {
  const uniqueCodes = [...new Set(cancelledBoothCodes.map((code) => code.trim()))]
    .filter(Boolean)
    .join(', ');
  if (!uniqueCodes) return failure;

  return `${failure} Booth ที่ยกเลิกสำเร็จแล้ว: ${uniqueCodes} การยกเลิกย้อนกลับไม่ได้ และยังไม่ได้ส่งคำขอคืนเงิน กรุณากดยื่นคำขออีกครั้ง`;
}

const thailandDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Bangkok',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

function hasExistingRefund(
  bookingId: string,
  refunds: Pick<RefundRequest, 'bookingId'>[],
): boolean {
  return refunds.some((refund) => refund.bookingId === bookingId);
}

function isCancellationWindowOpen(
  bookingEndDate: string,
  now: string | number = Date.now(),
): boolean {
  const endDate = new Date(bookingEndDate);
  const currentDate = new Date(now);
  if (
    Number.isNaN(endDate.getTime()) ||
    Number.isNaN(currentDate.getTime())
  ) {
    return false;
  }
  return (
    thailandDateFormatter.format(endDate) >=
    thailandDateFormatter.format(currentDate)
  );
}

export function canRequestRefund(
  booking: RefundBooking,
  refunds: Pick<RefundRequest, 'bookingId'>[],
): boolean {
  return (
    booking.status === 'CANCELLED' &&
    !booking.isPaymentExempt &&
    booking.confirmedAt !== null &&
    !hasExistingRefund(booking.id, refunds)
  );
}

export function refundFlowAction(
  booking: RefundFlowBooking,
  refunds: Pick<RefundRequest, 'bookingId'>[],
  now: string | number = Date.now(),
): RefundFlowAction | null {
  if (
    booking.isPaymentExempt ||
    booking.confirmedAt === null ||
    hasExistingRefund(booking.id, refunds)
  ) {
    return null;
  }
  if (booking.status === 'CANCELLED') return 'REQUEST';
  if (
    booking.status === 'CONFIRMED' &&
    isCancellationWindowOpen(booking.bookingEndDate, now)
  ) {
    return 'CANCEL_AND_REQUEST';
  }
  return null;
}

const AMOUNT_PATTERN = /^(?!0(?:\.0{1,2})?$)(?:0|[1-9]\d{0,7})(?:\.\d{1,2})?$/;

function toSatangDigits(value: string): string {
  const [whole, fraction = ''] = value.split('.');
  return `${whole}${fraction.padEnd(2, '0')}`.replace(/^0+(?=\d)/, '');
}

export function isValidRefundAmount(
  requestedAmount: string,
  boothPrice: string,
): boolean {
  if (!AMOUNT_PATTERN.test(requestedAmount)) return false;
  if (!/^\d+(?:\.\d{1,2})?$/.test(boothPrice)) return false;
  const requested = toSatangDigits(requestedAmount);
  const maximum = toSatangDigits(boothPrice);
  return (
    requested.length < maximum.length ||
    (requested.length === maximum.length && requested <= maximum)
  );
}

export function sumRefundAmounts(amounts: string[]): string | null {
  if (amounts.length === 0 || amounts.some((amount) => !AMOUNT_PATTERN.test(amount))) {
    return null;
  }

  const totalSatang = amounts.reduce(
    (total, amount) => total + BigInt(toSatangDigits(amount)),
    BigInt(0),
  );
  const digits = totalSatang.toString().padStart(3, '0');
  return `${digits.slice(0, -2)}.${digits.slice(-2)}`;
}
