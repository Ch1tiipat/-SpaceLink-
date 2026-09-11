export const ADMIN_TIMELINE_TYPES = [
  'BOOKING_CREATED',
  'PAYMENT_GROUP_CREATED',
  'SLIP_VERIFIED',
  'SLIP_FAILED',
  'BOOKING_CONFIRMED',
  'BOOKING_CANCELLED',
  'PAYMENT_GROUP_CONFIRMED',
  'PAYMENT_GROUP_CANCELLED',
  'REFUND_REQUESTED',
  'REFUND_REVIEWED',
  'REFUND_PROCESSED',
] as const;

export type AdminTimelineType = (typeof ADMIN_TIMELINE_TYPES)[number];

const LABELS: Record<AdminTimelineType, string> = {
  BOOKING_CREATED: 'สร้างการจอง',
  PAYMENT_GROUP_CREATED: 'สร้างกลุ่มชำระเงิน',
  SLIP_VERIFIED: 'ตรวจสอบสลิปสำเร็จ',
  SLIP_FAILED: 'ตรวจสอบสลิปไม่ผ่าน',
  BOOKING_CONFIRMED: 'ยืนยันการจอง',
  BOOKING_CANCELLED: 'ยกเลิกการจอง',
  PAYMENT_GROUP_CONFIRMED: 'ยืนยันกลุ่มชำระเงิน',
  PAYMENT_GROUP_CANCELLED: 'ยกเลิกกลุ่มชำระเงิน',
  REFUND_REQUESTED: 'ส่งคำร้องคืนเงิน',
  REFUND_REVIEWED: 'ตรวจคำร้องคืนเงิน',
  REFUND_PROCESSED: 'ดำเนินการคืนเงินแล้ว',
};

export function describeAdminTimelineItem(item: {
  type: AdminTimelineType;
  status?: string;
  amount?: string;
}) {
  const details: string[] = [];
  if (item.status) details.push(`สถานะ ${item.status}`);
  if (item.amount) details.push(`ยอด ${formatTimelineAmount(item.amount)}`);
  return {
    label: LABELS[item.type],
    detail: details.join(' · '),
    tone: timelineTone(item.type),
  };
}

export function timelineTone(type: AdminTimelineType): 'green' | 'red' | 'amber' | 'violet' {
  if (type === 'SLIP_FAILED' || type.includes('CANCELLED')) return 'red';
  if (type.includes('CONFIRMED') || type === 'SLIP_VERIFIED' || type === 'REFUND_PROCESSED') return 'green';
  if (type === 'REFUND_REQUESTED' || type === 'REFUND_REVIEWED') return 'amber';
  return 'violet';
}

function formatTimelineAmount(value: string) {
  const [whole = '0', fraction = ''] = value.split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `฿${grouped}.${fraction.padEnd(2, '0').slice(0, 2)}`;
}
