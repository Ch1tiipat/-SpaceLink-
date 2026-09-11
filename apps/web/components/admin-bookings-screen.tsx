import Link from 'next/link';
import { Ticket } from 'lucide-react';
import { AdminEmpty, AdminError, AdminPanel, formatAdminDateTime, formatAdminMoney } from '@/components/admin-ui';
import type { AdminTransactionBooking } from '@/lib/api';

const LABELS = { PENDING_PAYMENT: 'รอชำระเงิน', CONFIRMED: 'ยืนยันแล้ว', CANCELLED: 'ยกเลิกแล้ว', NO_SHOW: 'ไม่มาใช้พื้นที่', COMPLETED: 'เสร็จสิ้น' } as const;
const STYLES = { PENDING_PAYMENT: 'bg-[#fff4df] text-[#9a570f]', CONFIRMED: 'bg-[#e7f8ef] text-[#147653]', CANCELLED: 'bg-[#fff0ef] text-[#b42318]', NO_SHOW: 'bg-[#fff0ef] text-[#b42318]', COMPLETED: 'bg-[#eee8ff] text-[#6734c4]' } as const;

export function AdminBookingsScreen({ items, organizationId, loading, error }: { items: AdminTransactionBooking[]; organizationId: string; loading: boolean; error: string }) {
  return <AdminPanel title="รายการจอง" description="ข้อมูลจำกัดตามองค์กรและตัวกรองด้านบน" actions={<Link href={`/admin/booking-rescue?${new URLSearchParams({ organization: organizationId })}`} className="inline-flex h-9 items-center rounded-xl bg-violet px-3 text-xs font-extrabold text-white">ยืนยันแบบยกเว้นชำระเงิน</Link>}>
    {error ? <AdminError message={error} /> : loading ? <LoadingRows /> : items.length === 0 ? <AdminEmpty icon={Ticket} title="ไม่พบรายการจอง" description="ลองเปลี่ยนคำค้นหาหรือตัวกรอง" /> : <div className="overflow-x-auto"><table className="w-full min-w-[980px] border-collapse text-left text-sm"><thead className="bg-[#faf8fc] text-[11px] text-muted"><tr><th className="px-5 py-3">รหัสจอง</th><th className="px-4 py-3">ผู้ขาย / ร้าน</th><th className="px-4 py-3">อีเวนต์ / พื้นที่</th><th className="px-4 py-3">ยอดบูธ</th><th className="px-4 py-3">สถานะ</th><th className="px-4 py-3">สร้างเมื่อ</th></tr></thead><tbody>{items.map((item) => <tr key={item.id} className="border-t border-[#eee9f3] align-top"><td className="px-5 py-4 font-black text-ink">{item.bookingCode}</td><td className="px-4 py-4"><strong className="block text-ink">{item.shop.name}</strong><span className="text-xs text-muted">{item.vendor.fullName} · {item.vendor.email}</span></td><td className="px-4 py-4"><strong className="block text-ink">{item.event.name}</strong><span className="text-xs text-muted">{item.zone.name || item.zone.code} · บูธ {item.booth.code}</span></td><td className="px-4 py-4 font-extrabold">{formatAdminMoney(item.boothPrice)}</td><td className="px-4 py-4"><span className={`rounded-full px-2.5 py-1 text-[11px] font-extrabold ${STYLES[item.bookingStatus]}`}>{LABELS[item.bookingStatus]}</span>{item.paymentStatus === 'EXEMPT' ? <span className="mt-1 block text-[10px] font-bold text-violet">ยกเว้นชำระเงิน</span> : null}</td><td className="px-4 py-4 text-xs text-muted">{formatAdminDateTime(item.createdAt)}</td></tr>)}</tbody></table></div>}
  </AdminPanel>;
}

function LoadingRows() { return <div className="grid gap-3 p-5">{Array.from({ length: 6 }, (_, index) => <div key={index} className="skeleton h-16 rounded-xl" />)}</div>; }
