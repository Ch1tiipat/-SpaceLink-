'use client';

import { type FormEvent, useEffect, useState } from 'react';
import { BadgeDollarSign, Calculator, RefreshCw, Save } from 'lucide-react';
import {
  getPlatformBillingConfig,
  updatePlatformBillingConfig,
  type PlatformBillingConfig,
  type UpdatePlatformBillingConfigInput,
} from '@/lib/api';
import { getSupabaseBrowserClient } from '@/lib/supabase';

const DEFAULT_VALUES: UpdatePlatformBillingConfigInput = {
  baseFee: '500',
  perZoneRate: '50',
  perDayRate: '100',
  priceMin: '500',
  priceMax: '15000',
};

export function SuperAdminPlatformConfigScreen() {
  const [values, setValues] = useState(DEFAULT_VALUES);
  const [config, setConfig] = useState<PlatformBillingConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setLoading(true);
    setError('');

    void (async () => {
      try {
        const token = await getAccessToken();
        const result = await getPlatformBillingConfig(token, controller.signal);
        if (active) {
          setConfig(result);
          setValues({
            baseFee: result.baseFee,
            perZoneRate: result.perZoneRate,
            perDayRate: result.perDayRate,
            priceMin: result.priceMin,
            priceMax: result.priceMax,
          });
        }
      } catch (cause) {
        if (cause instanceof DOMException && cause.name === 'AbortError')
          return;
        if (active) setError(message(cause, 'โหลดค่าบริการแพลตฟอร์มไม่สำเร็จ'));
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
      controller.abort();
    };
  }, [reloadKey]);

  const examplePrice = addMoney(
    values.baseFee,
    multiplyMoney(values.perZoneRate, 4),
    multiplyMoney(values.perDayRate, 3),
  );

  async function save(event: FormEvent) {
    event.preventDefault();
    setError('');
    setNotice('');
    if (moneyCents(values.priceMin) > moneyCents(values.priceMax)) {
      setError('ราคาขั้นต่ำต้องไม่สูงกว่าราคาสูงสุด');
      return;
    }

    setSaving(true);
    try {
      const token = await getAccessToken();
      const result = await updatePlatformBillingConfig(values, token);
      setConfig(result);
      setNotice('บันทึกค่าบริการสำหรับ Event ใหม่เรียบร้อยแล้ว');
    } catch (cause) {
      setError(message(cause, 'บันทึกค่าบริการไม่สำเร็จ'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-[1180px] px-4 pb-12 pt-7 sm:px-8 sm:pt-10">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-extrabold tracking-[1.1px] text-[#7c3aed]">
            PLATFORM BILLING
          </p>
          <h1 className="mt-2 text-[28px] font-black tracking-[-.8px] text-[#242032]">
            ตั้งค่าค่าบริการ Event
          </h1>
          <p className="mt-1 text-[15px] text-[#82788b]">
            กำหนดสูตร Subscription ที่ใช้ตอนองค์กรสร้าง Event ใหม่
          </p>
        </div>
        <button
          type="button"
          onClick={() => setReloadKey((value) => value + 1)}
          disabled={loading}
          className="inline-flex h-10 items-center gap-2 self-start rounded-xl border border-[#ddd4e7] bg-white px-4 text-sm font-bold text-[#655d70] disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />{' '}
          โหลดข้อมูลใหม่
        </button>
      </header>

      <div className="mt-7 grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <form
          onSubmit={save}
          className="rounded-[22px] border border-[#e6deeb] bg-white p-5 shadow-[0_16px_38px_rgba(55,35,70,.06)] sm:p-7"
        >
          <div className="flex items-center gap-3 border-b border-[#eee8f2] pb-5">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-[#f1e9ff] text-violet">
              <BadgeDollarSign className="h-5 w-5" />
            </span>
            <div>
              <h2 className="font-black text-[#242032]">อัตราค่าบริการ</h2>
              <p className="text-sm text-[#82788b]">
                จำนวนเงินทั้งหมดเป็นบาทและรองรับทศนิยม 2 ตำแหน่ง
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <MoneyField
              label="ค่าพื้นฐานต่อ Event"
              value={values.baseFee}
              onChange={(value) =>
                setValues((current) => ({ ...current, baseFee: value }))
              }
            />
            <MoneyField
              label="ค่าบริการต่อโซน"
              value={values.perZoneRate}
              onChange={(value) =>
                setValues((current) => ({ ...current, perZoneRate: value }))
              }
            />
            <MoneyField
              label="ค่าบริการต่อวัน"
              value={values.perDayRate}
              onChange={(value) =>
                setValues((current) => ({ ...current, perDayRate: value }))
              }
            />
            <div className="hidden sm:block" />
            <MoneyField
              label="ราคาขั้นต่ำ"
              value={values.priceMin}
              onChange={(value) =>
                setValues((current) => ({ ...current, priceMin: value }))
              }
            />
            <MoneyField
              label="ราคาสูงสุด"
              value={values.priceMax}
              onChange={(value) =>
                setValues((current) => ({ ...current, priceMax: value }))
              }
            />
          </div>

          {error ? (
            <p className="mt-5 rounded-xl bg-[#fff0ef] px-4 py-3 text-sm font-bold text-[#b42318]">
              {error}
            </p>
          ) : null}
          {notice ? (
            <p className="mt-5 rounded-xl bg-[#effbf5] px-4 py-3 text-sm font-bold text-[#147653]">
              {notice}
            </p>
          ) : null}

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-[#eee8f2] pt-5">
            <p className="text-xs text-[#82788b]">
              {config?.id
                ? 'ใช้ค่าที่บันทึกในฐานข้อมูล'
                : 'ยังไม่มีรายการในฐานข้อมูล — กำลังแสดงค่าเริ่มต้นที่ปลอดภัย'}
            </p>
            <button
              type="submit"
              disabled={loading || saving}
              className="inline-flex h-11 items-center gap-2 rounded-xl bg-[linear-gradient(135deg,#9656f0,#6d28d9)] px-5 text-sm font-extrabold text-white disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {saving ? 'กำลังบันทึก…' : 'บันทึกค่าบริการ'}
            </button>
          </div>
        </form>

        <aside className="rounded-[22px] border border-[#ded2f3] bg-[#faf7ff] p-5 sm:p-6">
          <div className="flex items-center gap-2 text-violet">
            <Calculator className="h-5 w-5" />
            <h2 className="font-black">ตัวอย่างการคำนวณ</h2>
          </div>
          <p className="mt-4 text-sm leading-6 text-[#655d70]">
            Event ระยะเวลา 3 วัน และสถานที่มี 4 โซน
          </p>
          <div className="mt-4 space-y-2 rounded-2xl bg-white p-4 text-sm text-[#716675]">
            <p className="flex justify-between">
              <span>ค่าพื้นฐาน</span>
              <strong>{formatMoney(values.baseFee)}</strong>
            </p>
            <p className="flex justify-between">
              <span>4 โซน</span>
              <strong>4 × {formatMoney(values.perZoneRate)}</strong>
            </p>
            <p className="flex justify-between">
              <span>3 วัน</span>
              <strong>3 × {formatMoney(values.perDayRate)}</strong>
            </p>
            <p className="flex justify-between border-t border-[#e8def5] pt-3 text-base text-[#242032]">
              <span className="font-black">รวมก่อนจำกัดราคา</span>
              <strong>{formatMoney(examplePrice)}</strong>
            </p>
          </div>
          <p className="mt-4 text-xs leading-5 text-[#82788b]">
            ค่าที่แก้มีผลเฉพาะ Event ที่สร้างใหม่
            บิลเดิมจะเก็บราคาเดิมไว้เพื่อให้ตรวจสอบย้อนหลังได้
          </p>
        </aside>
      </div>
    </div>
  );
}

function MoneyField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="grid gap-1.5 text-sm font-bold text-[#342d3c]">
      <span>{label}</span>
      <div className="flex h-11 items-center rounded-xl border border-[#ddd4e7] bg-[#fcfbff] px-3 focus-within:border-violet">
        <input
          required
          inputMode="decimal"
          pattern="^(0|[1-9]\d{0,7})(\.\d{1,2})?$"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="min-w-0 flex-1 bg-transparent outline-none"
        />
        <span className="text-xs font-bold text-[#92899a]">บาท</span>
      </div>
    </label>
  );
}

async function getAccessToken() {
  const supabase = getSupabaseBrowserClient();
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('ไม่พบเซสชัน Super Admin กรุณาเข้าสู่ระบบใหม่');
  return token;
}

function moneyCents(value: string): bigint {
  const [whole = '0', fraction = ''] = value.split('.');
  return (
    BigInt(whole || '0') * HUNDRED +
    BigInt(fraction.padEnd(2, '0').slice(0, 2) || '0')
  );
}

function multiplyMoney(value: string, multiplier: number): string {
  return centsToMoney(moneyCents(value) * BigInt(multiplier));
}

function addMoney(...values: string[]): string {
  return centsToMoney(
    values.reduce((sum, value) => sum + moneyCents(value), ZERO_CENTS),
  );
}

function centsToMoney(value: bigint): string {
  return `${value / HUNDRED}.${(value % HUNDRED).toString().padStart(2, '0')}`;
}

function formatMoney(value: string): string {
  const cents = moneyCents(value);
  return `${(cents / HUNDRED).toLocaleString('th-TH')}.${(cents % HUNDRED).toString().padStart(2, '0')} บาท`;
}

function message(cause: unknown, fallback: string) {
  return cause instanceof Error ? cause.message || fallback : fallback;
}

const HUNDRED = BigInt(100);
const ZERO_CENTS = BigInt(0);
