'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { BadgeCheck, Building2, Gauge, Landmark, ShieldCheck } from 'lucide-react';
import {
  getMe,
  updateOrganizationBookingQuota,
  updateOrganizationPromptPay,
  type CurrentUser,
} from '@/lib/api';
import { getSupabaseBrowserClient } from '@/lib/supabase';
import { useAdminOrganizationSelection } from '@/components/app-shell';

type AccessState = 'loading' | 'allowed' | 'denied' | 'no-organization';

const PROMPTPAY_PATTERN = /^(\d{10}|\d{13}|\d{15})$/;

export function AdminOrganizationSettings() {
  const router = useRouter();
  const { selectedOrganizationId } = useAdminOrganizationSelection();
  const [access, setAccess] = useState<AccessState>('loading');
  const [token, setToken] = useState('');
  const [userRole, setUserRole] = useState<CurrentUser['role'] | null>(null);
  const [organizations, setOrganizations] = useState<
    CurrentUser['organizations']
  >([]);
  const [organizationId, setOrganizationId] = useState('');
  const [organizationName, setOrganizationName] = useState('');
  const [promptpayId, setPromptpayId] = useState('');
  const [currentBookingQuota, setCurrentBookingQuota] = useState<number | null>(
    null,
  );
  const [bookingQuotaInput, setBookingQuotaInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [quotaSaving, setQuotaSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [quotaError, setQuotaError] = useState<string | null>(null);
  const [quotaSuccess, setQuotaSuccess] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    void (async () => {
      try {
        const supabase = getSupabaseBrowserClient();
        const { data } = await supabase.auth.getSession();
        const accessToken = data.session?.access_token;
        if (!accessToken) {
          router.replace('/login');
          return;
        }

        const me = await getMe(accessToken, controller.signal);
        if (!active) return;
        if (me.role !== 'ORG_ADMIN' && me.role !== 'SUPER_ADMIN') {
          setAccess('denied');
          return;
        }

        const organization = me.organizations[0];
        if (!organization) {
          setAccess('no-organization');
          return;
        }

        setToken(accessToken);
        setUserRole(me.role);
        setOrganizations(me.organizations);
        setAccess('allowed');
      } catch (cause) {
        if (cause instanceof DOMException && cause.name === 'AbortError') return;
        if (active) setAccess('denied');
      }
    })();

    return () => {
      active = false;
      controller.abort();
    };
  }, [router]);

  useEffect(() => {
    if (access !== 'allowed') return;
    const organization = organizations.find(
      ({ id }) => id === selectedOrganizationId,
    );
    if (!organization) return;

    setOrganizationId(organization.id);
    setOrganizationName(organization.name);
    setPromptpayId(organization.promptpayId ?? '');
    setCurrentBookingQuota(organization.bookingQuotaPerVendor);
    setBookingQuotaInput(
      organization.bookingQuotaPerVendor?.toString() ?? '',
    );
  }, [access, organizations, selectedOrganizationId]);

  useEffect(() => {
    setError(null);
    setSuccess(null);
    setQuotaError(null);
    setQuotaSuccess(null);
  }, [selectedOrganizationId]);

  const selectedOrganization = organizations.find(
    ({ id }) => id === organizationId,
  );
  const canEditBookingQuota =
    userRole === 'ORG_ADMIN' && selectedOrganization?.canEditQuota === true;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (!PROMPTPAY_PATTERN.test(promptpayId)) {
      setError('กรุณากรอกเบอร์โทรศัพท์ เลขบัตรประชาชน หรือเลข e-Wallet ที่เป็นตัวเลข 10, 13 หรือ 15 หลัก');
      return;
    }

    setSaving(true);
    try {
      const updated = await updateOrganizationPromptPay(
        organizationId,
        promptpayId,
        token,
      );
      setPromptpayId(updated.promptpayId ?? '');
      setSuccess('บันทึกหมายเลข PromptPay เรียบร้อยแล้ว');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'บันทึกหมายเลข PromptPay ไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  }

  async function handleQuotaSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setQuotaError(null);
    setQuotaSuccess(null);

    if (!/^\d+$/.test(bookingQuotaInput)) {
      setQuotaError('กรุณากรอกโควตาเป็นจำนวนเต็มตั้งแต่ 0 ขึ้นไป');
      return;
    }

    const bookingQuotaPerVendor = Number(bookingQuotaInput);
    if (!Number.isSafeInteger(bookingQuotaPerVendor)) {
      setQuotaError('ค่าโควตามีขนาดใหญ่เกินกว่าที่ระบบรองรับ');
      return;
    }

    setQuotaSaving(true);
    let quotaUpdated = false;
    try {
      await updateOrganizationBookingQuota(
        organizationId,
        bookingQuotaPerVendor,
        token,
      );
      quotaUpdated = true;

      const refreshed = await getMe(token);
      const refreshedOrganization = refreshed.organizations.find(
        ({ id }) => id === organizationId,
      );
      if (!refreshedOrganization) {
        throw new Error('ไม่พบองค์กรที่เพิ่งอัปเดตในข้อมูลบัญชีล่าสุด');
      }

      setOrganizations(refreshed.organizations);
      setUserRole(refreshed.role);
      setCurrentBookingQuota(refreshedOrganization.bookingQuotaPerVendor);
      setBookingQuotaInput(
        refreshedOrganization.bookingQuotaPerVendor?.toString() ?? '',
      );
      setQuotaSuccess('บันทึกโควตาการจองเรียบร้อยแล้ว');
    } catch (cause) {
      setQuotaError(
        quotaUpdated
          ? 'บันทึกแล้วแต่โหลดค่าล่าสุดไม่สำเร็จ กรุณาโหลดหน้านี้ใหม่'
          : cause instanceof Error
            ? cause.message
            : 'บันทึกโควตาการจองไม่สำเร็จ',
      );
    } finally {
      setQuotaSaving(false);
    }
  }

  if (access === 'loading') {
    return (
      <main className="sl-page">
        <div className="shell py-10">
          <div className="skeleton h-48 rounded-[28px]" />
        </div>
      </main>
    );
  }

  if (access !== 'allowed') {
    const noOrganization = access === 'no-organization';
    return (
      <main className="sl-page">
        <div className="shell py-20 text-center">
          <ShieldCheck className="mx-auto h-12 w-12 text-violet" aria-hidden />
          <h1 className="mt-5 text-2xl font-black">
            {noOrganization ? 'ยังไม่มีองค์กรที่ดูแล' : 'ไม่มีสิทธิ์เข้าถึงหน้านี้'}
          </h1>
          <p className="mt-3 text-muted">
            {noOrganization
              ? 'บัญชีนี้ยังไม่ได้เป็นสมาชิกขององค์กร จึงยังตั้งค่า PromptPay ไม่ได้'
              : 'เฉพาะผู้ดูแลองค์กรเท่านั้นที่ตั้งค่าบัญชีรับชำระเงินได้'}
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="sl-page pb-16">
      <div className="shell py-8 sm:py-10">
        <section className="rounded-[24px] border border-[#e8e1ee] bg-white p-7 shadow-[0_12px_34px_rgba(54,36,91,0.045)] sm:p-9">
          <span className="inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.18em] text-violet">
            <ShieldCheck className="h-4 w-4" aria-hidden />
            Organization settings
          </span>
          <h1 className="mt-5 text-3xl font-black tracking-[-0.04em] sm:text-4xl">
            ตั้งค่าองค์กร
          </h1>
          <p className="mt-3 max-w-2xl text-muted">
            จัดการบัญชีรับชำระเงินและโควตาการจองขององค์กรตามสิทธิ์ที่ได้รับ
          </p>
        </section>

        <section className="mt-6 grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="sl-surface p-6">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-violet-tint text-violet">
              <Building2 className="h-6 w-6" aria-hidden />
            </span>
            <p className="mt-5 text-xs font-extrabold uppercase tracking-[0.14em] text-violet">
              องค์กรที่กำลังตั้งค่า
            </p>
            <h2 className="mt-2 text-xl font-black">{organizationName}</h2>
            <div className="mt-5 flex items-center gap-2 rounded-2xl bg-[#f5fbf8] px-4 py-3 text-sm font-bold text-[#187554]">
              <BadgeCheck className="h-5 w-5" aria-hidden />
              ยืนยันสิทธิ์ผู้ดูแลแล้ว
            </div>
          </aside>

          <div className="grid gap-6">
            <form className="sl-surface p-6 sm:p-8" onSubmit={handleSubmit}>
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-violet-tint text-violet">
                <Landmark className="h-5 w-5" aria-hidden />
              </span>
              <div>
                <h2 className="text-xl font-black">หมายเลข PromptPay</h2>
                <p className="text-sm text-muted">รองรับเบอร์โทรศัพท์ เลขบัตรประชาชน และ e-Wallet</p>
              </div>
            </div>

            <label className="mt-7 block text-sm font-bold" htmlFor="promptpay-id">
              หมายเลขรับเงิน
            </label>
            <input
              id="promptpay-id"
              name="promptpayId"
              className="mt-2 w-full rounded-2xl border border-line bg-white px-4 py-3.5 outline-none transition focus:border-violet focus:ring-4 focus:ring-violet/10"
              inputMode="numeric"
              autoComplete="off"
              maxLength={15}
              value={promptpayId}
              onChange={(event) => {
                setPromptpayId(event.target.value.replace(/\D/g, ''));
                setError(null);
                setSuccess(null);
              }}
              placeholder="เช่น 0812345678"
              aria-describedby="promptpay-help promptpay-feedback"
            />
            <p id="promptpay-help" className="mt-2 text-xs text-muted">
              กรอกตัวเลข 10, 13 หรือ 15 หลัก ระบบจะไม่แสดงหมายเลขนี้ใน API สาธารณะ
            </p>

            <div id="promptpay-feedback" aria-live="polite">
              {error ? <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</p> : null}
              {success ? <p className="mt-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">{success}</p> : null}
            </div>

            <button
              type="submit"
              disabled={saving}
              className="mt-6 inline-flex min-h-12 items-center justify-center rounded-2xl bg-violet px-6 py-3 font-extrabold text-white shadow-lg shadow-violet/20 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? 'กำลังบันทึก...' : 'บันทึกการตั้งค่า'}
            </button>
            </form>

            {canEditBookingQuota ? (
              <form
                className="sl-surface p-6 sm:p-8"
                onSubmit={handleQuotaSubmit}
              >
                <div className="flex items-center gap-3">
                  <span className="grid h-11 w-11 place-items-center rounded-2xl bg-violet-tint text-violet">
                    <Gauge className="h-5 w-5" aria-hidden />
                  </span>
                  <div>
                    <h2 className="text-xl font-black">โควตาการจองต่ออีเวนต์</h2>
                    <p className="text-sm text-muted">
                      จำกัดจำนวนบูธที่ผู้ขายหนึ่งรายจองได้ในแต่ละอีเวนต์
                    </p>
                  </div>
                </div>

                <p className="mt-6 rounded-2xl bg-[#f8f5fb] px-4 py-3 text-sm text-[#62576c]">
                  ค่าปัจจุบัน:{' '}
                  <strong className="text-[#242032]">
                    {currentBookingQuota === null
                      ? 'ยังไม่ได้กำหนดค่าเฉพาะองค์กร'
                      : `${currentBookingQuota.toLocaleString('th-TH')} บูธ`}
                  </strong>
                </p>

                <label
                  className="mt-6 block text-sm font-bold"
                  htmlFor="booking-quota-per-vendor"
                >
                  จำนวนบูธสูงสุดต่อผู้ขาย
                </label>
                <input
                  id="booking-quota-per-vendor"
                  name="bookingQuotaPerVendor"
                  type="number"
                  min={0}
                  step={1}
                  inputMode="numeric"
                  className="mt-2 w-full rounded-2xl border border-line bg-white px-4 py-3.5 outline-none transition focus:border-violet focus:ring-4 focus:ring-violet/10"
                  value={bookingQuotaInput}
                  onChange={(event) => {
                    setBookingQuotaInput(event.target.value.replace(/\D/g, ''));
                    setQuotaError(null);
                    setQuotaSuccess(null);
                  }}
                  placeholder="เช่น 2"
                  aria-describedby="booking-quota-help booking-quota-feedback"
                />
                <p id="booking-quota-help" className="mt-2 text-xs text-muted">
                  กำหนดเป็นจำนวนเต็มตั้งแต่ 0 ขึ้นไป โดย 0 หมายถึงไม่อนุญาตให้จอง
                </p>

                <div id="booking-quota-feedback" aria-live="polite">
                  {quotaError ? (
                    <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
                      {quotaError}
                    </p>
                  ) : null}
                  {quotaSuccess ? (
                    <p className="mt-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">
                      {quotaSuccess}
                    </p>
                  ) : null}
                </div>

                <button
                  type="submit"
                  disabled={quotaSaving}
                  className="mt-6 inline-flex min-h-12 items-center justify-center rounded-2xl bg-violet px-6 py-3 font-extrabold text-white shadow-lg shadow-violet/20 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {quotaSaving ? 'กำลังบันทึก...' : 'บันทึกโควตาการจอง'}
                </button>
              </form>
            ) : null}
          </div>
        </section>
      </div>
    </main>
  );
}
