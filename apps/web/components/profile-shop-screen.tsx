'use client';

import Link from 'next/link';
import { useState } from 'react';
import {
  Mail,
  Package,
  Phone,
  Store,
  UserRound,
  type LucideIcon,
} from 'lucide-react';
import { MultiSelectMenu } from '@/components/multi-select-menu';
import type { SelectMenuOption } from '@/components/select-menu';
import type { CurrentUser, VendorShop } from '@/lib/api';
import { useVendorProfile } from '@/lib/use-vendor-profile';

/* ------------------------------------------------------------------ *
 * Phase 1 mock data
 *
 * Everything in this block is hardcoded so both branches of the page —
 * "no shop yet" and "has exactly one shop" — can be built and looked at
 * before the endpoints behind them exist. Each value carries the TODO naming
 * the call that replaces it. Nothing here reaches the network.
 * ------------------------------------------------------------------ */

/** TODO(Phase 4): GET /categories */
const MOCK_CATEGORY_OPTIONS: SelectMenuOption[] = [
  { value: 'cat-food', label: 'อาหารและเครื่องดื่ม' },
  { value: 'cat-fashion', label: 'แฟชั่นและเครื่องแต่งกาย' },
  { value: 'cat-craft', label: 'งานคราฟต์และแฮนด์เมด' },
  { value: 'cat-beauty', label: 'ความงามและสุขภาพ' },
  { value: 'cat-home', label: 'ของแต่งบ้านและต้นไม้' },
  { value: 'cat-secondhand', label: 'สินค้ามือสอง' },
];

/**
 * Vendor Score and Blacklist Point are in the approved design but on no wire
 * type: `averageRating` is derived and never stored (AGENTS.md §6.3), and the
 * points behind `isBlacklisted` are accumulated `penalty.points`. `GET
 * /auth/me` returns neither today, so Phase 1 carries them as mock values and a
 * later phase decides where they come from.
 */
type VendorStats = {
  /** `null` means no review has been left yet — never render that as 0. */
  averageRating: number | null;
  blacklistPoints: number;
};

/** TODO(Phase 4): the endpoint that exposes a vendor's own score and points. */
const MOCK_STATS: VendorStats = { averageRating: 4.9, blacklistPoints: 0 };

/** TODO(Phase 4): GET /auth/me, through `useVendorProfile()` below. */
const MOCK_PROFILE: CurrentUser = {
  id: '00000000-0000-4000-8000-000000000001',
  authUserId: '00000000-0000-4000-8000-000000000002',
  email: 'vendor@example.com',
  fullName: 'สมหญิง ใจดี',
  phone: '081-234-5678',
  role: 'VENDOR',
  isBlacklisted: false,
  createdAt: '2026-01-12T03:00:00.000Z',
  updatedAt: '2026-07-30T08:15:00.000Z',
  shops: [],
};

/** TODO(Phase 4): GET /shops/me — served today by `CurrentUser.shops[0]`. */
const MOCK_SHOP: VendorShop = {
  id: '00000000-0000-4000-8000-000000000003',
  name: 'ครัวคุณหญิง',
  description:
    'อาหารตามสั่งและของหวานไทยทำสด ขายในตลาดนัดและงานอีเวนต์ทั่วภาคอีสาน',
  logoUrl: null,
  categories: [
    { id: 'cat-food', name: 'อาหารและเครื่องดื่ม' },
    { id: 'cat-craft', name: 'งานคราฟต์และแฮนด์เมด' },
  ],
};

/**
 * Which mock branch renders. Flip to `'no-shop'` to see the create-shop form;
 * both branches are driven from the same mock profile.
 */
const MOCK_VARIANT: 'with-shop' | 'no-shop' = 'with-shop';

const PENDING_BACKEND_NOTICE =
  'ยังบันทึกไม่ได้ในตอนนี้ — หน้านี้ยังไม่ได้เชื่อมต่อ API ร้านค้า ข้อมูลที่กรอกจะยังไม่ถูกส่งไปที่ระบบ';

export function ProfileShopScreen() {
  const { state } = useVendorProfile();
  const [isEditing, setIsEditing] = useState(false);

  // Phase 1 renders mock data even once the session resolves, so the layout can
  // be reviewed without a database behind it. The hook still drives loading,
  // signed-out and error, which are real.
  // TODO(Phase 4): read `state.profile` and `state.shop` here instead.
  const profile = MOCK_PROFILE;
  const shop = MOCK_VARIANT === 'with-shop' ? MOCK_SHOP : null;

  return (
    <main className="pb-16">
      <div className="shell py-8">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <span className="text-xs font-bold uppercase tracking-[.14em] text-violet">
              Profile
            </span>
            <h1 className="mt-2 text-3xl font-bold tracking-[-0.04em] sm:text-4xl">
              โปรไฟล์ของฉัน
            </h1>
            <p className="mt-2 text-muted">
              ข้อมูลนี้จะถูกดึงไปใช้ในการจองและแสดงบนบูธ
            </p>
          </div>

          {state.status === 'ready' && shop && !isEditing && (
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="mt-4 inline-flex rounded-xl border border-violet px-5 py-3 font-bold text-violet sm:mt-0"
            >
              แก้ไขโปรไฟล์
            </button>
          )}
        </div>

        {state.status === 'loading' && (
          <div className="mt-8 grid gap-[18px] lg:grid-cols-[290px_minmax(0,1fr)]">
            <div className="skeleton h-64 rounded-[28px]" />
            <div className="skeleton h-64 rounded-[28px]" />
          </div>
        )}

        {state.status === 'signed-out' && (
          <section className="mt-8 rounded-[28px] border border-line bg-white p-8 text-center shadow-soft">
            <h2 className="text-xl font-bold">กรุณาเข้าสู่ระบบก่อน</h2>
            <p className="mt-2 text-muted">
              โปรไฟล์และข้อมูลร้านค้าจะแสดงเฉพาะของบัญชีผู้ขายปัจจุบัน
            </p>
            <Link
              href="/login"
              className="mt-6 inline-flex rounded-xl bg-violet px-5 py-3 font-bold text-white"
            >
              เข้าสู่ระบบ
            </Link>
          </section>
        )}

        {state.status === 'error' && (
          <p
            role="alert"
            className="mt-8 rounded-2xl bg-[#fff0ee] px-5 py-4 text-[#b42318]"
          >
            {state.message}
          </p>
        )}

        {state.status === 'ready' && !shop && (
          <section className="mt-8 rounded-[28px] border border-line bg-white p-6 shadow-soft sm:p-8">
            <h2 className="text-xl font-bold">เพิ่มข้อมูลร้านค้า</h2>
            <p className="mt-2 max-w-2xl text-muted">
              บัญชีนี้ยังไม่มีร้านค้า — สร้างร้านของคุณก่อนเริ่มจองบูธ
              หนึ่งบัญชีมีได้หนึ่งร้าน
            </p>
            <div className="mt-6 max-w-2xl">
              <ShopForm mode="create" profile={profile} shop={null} />
            </div>
          </section>
        )}

        {state.status === 'ready' && shop && (
          <div className="mt-8 grid gap-[18px] lg:grid-cols-[290px_minmax(0,1fr)]">
            <aside className="rounded-[28px] border border-line bg-white p-6 text-center shadow-soft">
              <span
                aria-hidden
                className="mx-auto grid h-[82px] w-[82px] place-items-center rounded-[28px] bg-gradient-to-br from-[#C4B5FD] to-[#6D28D9] text-[27px] font-bold text-white"
              >
                {[...shop.name.trim()][0] ?? '?'}
              </span>
              <h2 className="mt-3.5 text-lg font-bold">{shop.name}</h2>
              <p className="mt-0.5 text-[13px] text-muted">
                {profile.fullName}
              </p>

              <div className="mt-5 grid grid-cols-2 gap-2">
                <ScoreCell
                  label="Vendor Score"
                  value={
                    MOCK_STATS.averageRating === null
                      ? 'ยังไม่มีรีวิว'
                      : MOCK_STATS.averageRating.toFixed(1)
                  }
                  muted={MOCK_STATS.averageRating === null}
                />
                <ScoreCell
                  label="Blacklist Point"
                  value={String(MOCK_STATS.blacklistPoints)}
                />
              </div>
            </aside>

            <section className="rounded-[28px] border border-line bg-white p-6 shadow-soft sm:p-7">
              <h2 className="text-lg font-bold">ข้อมูลร้านค้า</h2>

              {isEditing ? (
                <div className="mt-4 max-w-2xl">
                  <ShopForm
                    mode="edit"
                    profile={profile}
                    shop={shop}
                    onCancel={() => setIsEditing(false)}
                  />
                </div>
              ) : (
                <dl className="mt-4 grid gap-3">
                  <InfoLine icon={UserRound} label="ชื่อร้าน" value={shop.name} />
                  <InfoLine
                    icon={Phone}
                    label="เบอร์โทรศัพท์"
                    value={profile.phone ?? 'ยังไม่ระบุ'}
                  />
                  <InfoLine icon={Mail} label="อีเมล" value={profile.email} />
                  <InfoLine
                    icon={Store}
                    label="รายละเอียดร้าน"
                    value={shop.description ?? 'ยังไม่ระบุ'}
                  />
                  <InfoLine
                    icon={Package}
                    label="สินค้าที่ขาย"
                    value={
                      shop.categories
                        .map((category) => category.name)
                        .join(', ') || 'ยังไม่ระบุ'
                    }
                  />
                </dl>
              )}
            </section>
          </div>
        )}
      </div>
    </main>
  );
}

function ScoreCell({
  label,
  value,
  muted = false,
}: {
  label: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <div className="rounded-xl bg-[#FAF8FF] p-2.5">
      <b className={`block ${muted ? 'text-[13px] text-muted' : 'text-[17px]'}`}>
        {value}
      </b>
      <span className="text-[10px] text-muted">{label}</span>
    </div>
  );
}

function InfoLine({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-[#F0EDF3] pb-[11px] last:border-0 last:pb-0">
      <dt className="flex shrink-0 items-center gap-2 text-muted">
        <Icon aria-hidden className="h-4 w-4" strokeWidth={2} />
        {label}
      </dt>
      <dd className="min-w-0 text-right font-bold">{value}</dd>
    </div>
  );
}

/**
 * One form for both branches: creating the vendor's only shop, and editing it.
 * The fields are identical, so the mode changes the submit label and whether
 * there is anything to cancel back to.
 *
 * Inline rather than a modal — this codebase has no dialog anywhere yet, and a
 * flat page matches the screens around it.
 */
function ShopForm({
  mode,
  profile,
  shop,
  onCancel,
}: {
  mode: 'create' | 'edit';
  profile: CurrentUser;
  shop: VendorShop | null;
  onCancel?: () => void;
}) {
  const [name, setName] = useState(shop?.name ?? '');
  const [description, setDescription] = useState(shop?.description ?? '');
  const [categoryIds, setCategoryIds] = useState<string[]>(
    shop?.categories.map((category) => category.id) ?? [],
  );
  const [phone, setPhone] = useState(profile.phone ?? '');
  const [nameError, setNameError] = useState<string | null>(null);
  const [categoryError, setCategoryError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextNameError = name.trim() ? null : 'กรุณากรอกชื่อร้าน';
    const nextCategoryError =
      categoryIds.length > 0 ? null : 'กรุณาเลือกหมวดสินค้าอย่างน้อย 1 หมวด';

    setNameError(nextNameError);
    setCategoryError(nextCategoryError);

    if (nextNameError || nextCategoryError) {
      setNotice(null);
      return;
    }

    // TODO(Phase 4): POST /shops when `mode === 'create'`,
    // PATCH /shops/me when `mode === 'edit'`, then `refresh()` from
    // `useVendorProfile()`. The phone field is a separate PATCH /users/me —
    // it belongs to `app_user`, not to the shop.
    setNotice(PENDING_BACKEND_NOTICE);
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="grid gap-4">
      <label className="block">
        <span className="mb-2 block text-sm font-bold">ชื่อร้าน</span>
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          aria-invalid={nameError ? true : undefined}
          aria-describedby={nameError ? 'shop-name-error' : undefined}
          placeholder="เช่น ครัวคุณหญิง"
          className={`w-full rounded-xl border bg-white px-4 py-3 text-sm outline-none ${
            nameError ? 'border-danger' : 'border-line'
          }`}
        />
        {nameError && (
          <span
            id="shop-name-error"
            role="alert"
            className="mt-2 block text-sm text-danger"
          >
            {nameError}
          </span>
        )}
      </label>

      <label className="block">
        <span className="mb-2 block text-sm font-bold">รายละเอียดร้าน</span>
        <textarea
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          rows={3}
          placeholder="อธิบายสินค้าและจุดเด่นของร้านสั้น ๆ"
          className="w-full rounded-xl border border-line bg-white px-4 py-3 text-sm outline-none"
        />
      </label>

      <div>
        <MultiSelectMenu
          label="สินค้าที่ขาย"
          placeholder="เลือกหมวดสินค้า"
          value={categoryIds}
          onChange={(value) => {
            setCategoryIds(value);
            if (value.length > 0) setCategoryError(null);
          }}
          options={MOCK_CATEGORY_OPTIONS}
          invalid={Boolean(categoryError)}
          describedBy={categoryError ? 'shop-categories-error' : undefined}
        />
        {categoryError && (
          <p
            id="shop-categories-error"
            role="alert"
            className="mt-2 text-sm text-danger"
          >
            {categoryError}
          </p>
        )}
      </div>

      <label className="block">
        <span className="mb-2 block text-sm font-bold">เบอร์โทรศัพท์</span>
        <input
          type="tel"
          inputMode="tel"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          placeholder="08X-XXX-XXXX"
          className="w-full rounded-xl border border-line bg-white px-4 py-3 text-sm outline-none"
        />
      </label>

      <label className="block">
        <span className="mb-2 block text-sm font-bold">อีเมล</span>
        {/* Read-only on purpose: the address is the Supabase Auth identity
            (AGENTS.md §7) and there is no endpoint that changes it. */}
        <input
          value={profile.email}
          readOnly
          disabled
          className="w-full rounded-xl border border-line bg-[#F7F5FA] px-4 py-3 text-sm text-muted outline-none"
        />
        <span className="mt-2 block text-xs text-muted">
          อีเมลใช้สำหรับเข้าสู่ระบบ จึงแก้ไขที่หน้านี้ไม่ได้
        </span>
      </label>

      {notice && (
        <p
          role="status"
          className="rounded-2xl bg-[#FFF7E6] px-4 py-3 text-sm text-[#8a5a00]"
        >
          {notice}
        </p>
      )}

      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          className="rounded-xl bg-violet px-5 py-3 font-bold text-white"
        >
          {mode === 'create' ? 'สร้างร้านค้า' : 'บันทึกข้อมูล'}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-line px-5 py-3 font-bold text-ink"
          >
            ยกเลิก
          </button>
        )}
      </div>
    </form>
  );
}
