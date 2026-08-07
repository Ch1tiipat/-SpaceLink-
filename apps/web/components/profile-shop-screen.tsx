'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
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
import {
  ApiError,
  createShop,
  getCategories,
  updateMe,
  updateShop,
  type CurrentUser,
  type ProductCategory,
  type VendorShop,
} from '@/lib/api';
import { useVendorProfile } from '@/lib/use-vendor-profile';

/**
 * Digits only, matching THAI_PHONE_PATTERN in the API's update-me.dto.ts:
 * a leading zero then 8 or 9 more, covering 10-digit mobile and 9-digit
 * landline. Checked here as well so a mistyped number gets a Thai message
 * rather than the backend's raw class-validator string.
 */
const THAI_PHONE_PATTERN = /^0\d{8,9}$/;

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

export function ProfileShopScreen() {
  const { state, refresh } = useVendorProfile();
  const [isEditing, setIsEditing] = useState(false);
  const [categories, setCategories] = useState<ProductCategory[] | null>(null);
  const [categoriesError, setCategoriesError] = useState<string | null>(null);

  // Narrowed once, so profile, shop and token cannot drift apart below: all
  // three come from the same `ready` branch of the same render.
  const ready = state.status === 'ready' ? state : null;

  // Product categories are public reference data (GET /categories has no
  // guard), so this is deliberately not gated behind the session — the form
  // needs its options whether or not `/auth/me` has answered yet.
  useEffect(() => {
    const controller = new AbortController();

    getCategories(controller.signal)
      .then(setCategories)
      .catch((cause: unknown) => {
        if (cause instanceof DOMException && cause.name === 'AbortError') return;
        setCategoriesError(
          cause instanceof Error ? cause.message : 'โหลดหมวดสินค้าไม่สำเร็จ',
        );
      });

    return () => controller.abort();
  }, []);

  const categoryOptions = useMemo<SelectMenuOption[]>(
    () =>
      (categories ?? []).map((category) => ({
        value: category.id,
        label: category.name,
      })),
    [categories],
  );
  const categoriesLoading = categories === null && categoriesError === null;

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

          {ready && ready.shop && !isEditing && (
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

        {ready && !ready.shop && (
          <section className="mt-8 rounded-[28px] border border-line bg-white p-6 shadow-soft sm:p-8">
            <h2 className="text-xl font-bold">เพิ่มข้อมูลร้านค้า</h2>
            <p className="mt-2 max-w-2xl text-muted">
              บัญชีนี้ยังไม่มีร้านค้า — สร้างร้านของคุณก่อนเริ่มจองบูธ
              หนึ่งบัญชีมีได้หนึ่งร้าน
            </p>
            <div className="mt-6 max-w-2xl">
              <ShopForm
                mode="create"
                profile={ready.profile}
                shop={null}
                token={ready.token}
                refresh={refresh}
                options={categoryOptions}
                optionsLoading={categoriesLoading}
                optionsError={categoriesError}
              />
            </div>
          </section>
        )}

        {ready && ready.shop && (
          <div className="mt-8 grid gap-[18px] lg:grid-cols-[290px_minmax(0,1fr)]">
            <aside className="rounded-[28px] border border-line bg-white p-6 text-center shadow-soft">
              <span
                aria-hidden
                className="mx-auto grid h-[82px] w-[82px] place-items-center rounded-[28px] bg-gradient-to-br from-[#C4B5FD] to-[#6D28D9] text-[27px] font-bold text-white"
              >
                {[...ready.shop.name.trim()][0] ?? '?'}
              </span>
              <h2 className="mt-3.5 text-lg font-bold">{ready.shop.name}</h2>
              <p className="mt-0.5 text-[13px] text-muted">
                {ready.profile.fullName}
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
                    profile={ready.profile}
                    shop={ready.shop}
                    token={ready.token}
                    refresh={refresh}
                    options={categoryOptions}
                    optionsLoading={categoriesLoading}
                    optionsError={categoriesError}
                    onCancel={() => setIsEditing(false)}
                  />
                </div>
              ) : (
                <dl className="mt-4 grid gap-3">
                  <InfoLine
                    icon={UserRound}
                    label="ชื่อร้าน"
                    value={ready.shop.name}
                  />
                  <InfoLine
                    icon={Phone}
                    label="เบอร์โทรศัพท์"
                    value={ready.profile.phone ?? 'ยังไม่ระบุ'}
                  />
                  <InfoLine
                    icon={Mail}
                    label="อีเมล"
                    value={ready.profile.email}
                  />
                  <InfoLine
                    icon={Store}
                    label="รายละเอียดร้าน"
                    value={ready.shop.description ?? 'ยังไม่ระบุ'}
                  />
                  <InfoLine
                    icon={Package}
                    label="สินค้าที่ขาย"
                    value={
                      ready.shop.categories
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
  token,
  refresh,
  options,
  optionsLoading,
  optionsError,
  onCancel,
}: {
  mode: 'create' | 'edit';
  profile: CurrentUser;
  shop: VendorShop | null;
  token: string;
  /** `refresh()` from `useVendorProfile()` — called only after a save wins. */
  refresh: () => void;
  options: SelectMenuOption[];
  optionsLoading: boolean;
  optionsError: string | null;
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
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;

    const trimmedPhone = phone.trim();
    const nextNameError = name.trim() ? null : 'กรุณากรอกชื่อร้าน';
    const nextCategoryError =
      categoryIds.length > 0 ? null : 'กรุณาเลือกหมวดสินค้าอย่างน้อย 1 หมวด';
    const nextPhoneError =
      trimmedPhone && !THAI_PHONE_PATTERN.test(trimmedPhone)
        ? 'กรุณากรอกเบอร์โทรศัพท์เป็นตัวเลข 9-10 หลัก ขึ้นต้นด้วย 0'
        : null;

    setNameError(nextNameError);
    setCategoryError(nextCategoryError);
    setPhoneError(nextPhoneError);

    if (nextNameError || nextCategoryError || nextPhoneError) {
      setNotice(null);
      return;
    }

    setIsSubmitting(true);
    setNotice(null);

    // Two endpoints, because the fields belong to two rows: the shop is
    // POST /shops or PATCH /shops/me, and the phone is PATCH /users/me on
    // `app_user`. `description` and `phone` are sent as `undefined` when empty
    // rather than as null — the DTOs read an omitted key as "leave it alone"
    // and answer 400 to an explicit null.
    try {
      const payload = {
        name: name.trim(),
        description: description.trim() || undefined,
        categoryIds,
      };

      if (mode === 'create') {
        await createShop(payload, token);
      } else {
        await updateShop(payload, token);
      }

      if (trimmedPhone) {
        await updateMe({ phone: trimmedPhone }, token);
      }

      refresh();
      // Editing closes back to the read-only card; the refreshed profile and
      // shop then arrive as props. Creating has nothing to close — the page
      // swaps to the shop card on its own once `refresh()` lands.
      if (mode === 'edit') onCancel?.();
    } catch (cause) {
      setNotice(
        cause instanceof ApiError
          ? cause.message
          : 'เกิดข้อผิดพลาดที่ไม่คาดคิด กรุณาลองใหม่อีกครั้ง',
      );
    } finally {
      setIsSubmitting(false);
    }
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
        {/* MultiSelectMenu has no `disabled` prop, so while the options are
            still loading the trigger is made inert here instead — opening an
            empty picker would read as "there are no categories". */}
        <div className={optionsLoading ? 'pointer-events-none opacity-60' : ''}>
          <MultiSelectMenu
            label="สินค้าที่ขาย"
            placeholder={
              optionsLoading ? 'กำลังโหลดหมวดสินค้า…' : 'เลือกหมวดสินค้า'
            }
            value={categoryIds}
            onChange={(value) => {
              setCategoryIds(value);
              if (value.length > 0) setCategoryError(null);
            }}
            options={options}
            invalid={Boolean(categoryError)}
            describedBy={categoryError ? 'shop-categories-error' : undefined}
          />
        </div>
        {categoryError && (
          <p
            id="shop-categories-error"
            role="alert"
            className="mt-2 text-sm text-danger"
          >
            {categoryError}
          </p>
        )}
        {optionsError && (
          <p role="alert" className="mt-2 text-sm text-danger">
            {optionsError}
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
          aria-invalid={phoneError ? true : undefined}
          aria-describedby={phoneError ? 'shop-phone-error' : undefined}
          placeholder="0812345678"
          className={`w-full rounded-xl border bg-white px-4 py-3 text-sm outline-none ${
            phoneError ? 'border-danger' : 'border-line'
          }`}
        />
        {phoneError && (
          <span
            id="shop-phone-error"
            role="alert"
            className="mt-2 block text-sm text-danger"
          >
            {phoneError}
          </span>
        )}
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
          role="alert"
          className="rounded-2xl border border-[#f1c6d0] bg-[#fff4f6] px-4 py-3 text-sm text-danger"
        >
          {notice}
        </p>
      )}

      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={isSubmitting || optionsLoading}
          className="rounded-xl bg-violet px-5 py-3 font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {isSubmitting
            ? 'กำลังบันทึก…'
            : mode === 'create'
              ? 'สร้างร้านค้า'
              : 'บันทึกข้อมูล'}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="rounded-xl border border-line px-5 py-3 font-bold text-ink disabled:cursor-not-allowed disabled:opacity-60"
          >
            ยกเลิก
          </button>
        )}
      </div>
    </form>
  );
}
