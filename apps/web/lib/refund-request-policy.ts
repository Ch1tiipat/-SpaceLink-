import type { MyBooking, RefundRequest } from './api';

type RefundBooking = Pick<
  MyBooking,
  'id' | 'status' | 'isPaymentExempt' | 'confirmedAt'
>;

export function canRequestRefund(
  booking: RefundBooking,
  refunds: Pick<RefundRequest, 'bookingId'>[],
): boolean {
  return (
    booking.status === 'CANCELLED' &&
    !booking.isPaymentExempt &&
    booking.confirmedAt !== null &&
    !refunds.some((refund) => refund.bookingId === booking.id)
  );
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
