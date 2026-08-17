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
  getAverageRating,
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

/** Blacklist points remain mocked until SCRUM-77 wires the penalty total. */
type VendorStats = {
  blacklistPoints: number;
};

/** TODO(SCRUM-77): replace the remaining blacklist-points mock. */
const MOCK_STATS: VendorStats = { blacklistPoints: 0 };

export function ProfileShopScreen() {
  const { state, refresh } = useVendorProfile();
  const [isEditing, setIsEditing] = useState(false);
  const [categories, setCategories] = useState<ProductCategory[] | null>(null);
  const [categoriesError, setCategoriesError] = useState<string | null>(null);
  // Lives here rather than in ShopForm because the form is gone by the time it
  // has to be read: a save that succeeds unmounts the create form and closes
  // the edit form, taking the form's own `notice` with it. A shop that saved
  // while its phone number did not is exactly the case the vendor must still
  // see afterwards, so it is held one level up and rendered next to the card.
  const [phoneSaveWarning, setPhoneSaveWarning] = useState<string | null>(null);
  const [averageRating, setAverageRating] = useState<number | null>(null);
  const [ratingState, setRatingState] = useState<
    'idle' | 'loading' | 'ready' | 'error'
  >('idle');

  // Narrowed once, so profile, shop and token cannot drift apart below: all
  // three come from the same `ready` branch of the same render.
  const ready = state.status === 'ready' ? state : null;
  const readyShopId = ready?.shop?.id ?? null;

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

  useEffect(() => {
    if (!readyShopId) {
      setAverageRating(null);
      setRatingState('idle');
      return;
    }

    const controller = new AbortController();
    setRatingState('loading');
    getAverageRating('SHOP', readyShopId, controller.signal)
      .then((result) => {
        setAverageRating(result.average);
        setRatingState('ready');
      })
      .catch((cause: unknown) => {
        if (cause instanceof DOMException && cause.name === 'AbortError') return;
        setRatingState('error');
      });

    return () => controller.abort();
  }, [readyShopId]);

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
    <main className="sl-page pb-16">
      <div className="shell py-8">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <span className="sl-kicker">
              Profile
            </span>
            <h1 className="mt-2 text-3xl font-black tracking-[-0.045em] sm:text-4xl">
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
              className="sl-action-secondary mt-4 text-violet sm:mt-0"
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
          <section className="sl-surface mt-8 p-8 text-center">
            <h2 className="text-xl font-bold">กรุณาเข้าสู่ระบบก่อน</h2>
            <p className="mt-2 text-muted">
              โปรไฟล์และข้อมูลร้านค้าจะแสดงเฉพาะของบัญชีผู้ขายปัจจุบัน
            </p>
            <Link
              href="/login"
              className="sl-action-primary mt-6"
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
          <section className="sl-surface mt-8 p-6 sm:p-8">
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
                setPhoneSaveWarning={setPhoneSaveWarning}
                options={categoryOptions}
                optionsLoading={categoriesLoading}
                optionsError={categoriesError}
              />
            </div>
          </section>
        )}

        {ready && ready.shop && (
          <>
            {phoneSaveWarning && (
              <p
                role="alert"
                className="mt-8 rounded-2xl bg-[#fff0ee] px-5 py-4 text-[#b42318]"
              >
                {phoneSaveWarning}
              </p>
            )}

            <div className="mt-8 grid gap-[18px] lg:grid-cols-[290px_minmax(0,1fr)]">
              <aside className="sl-surface relative overflow-hidden p-6 text-center">
                <span
                  aria-hidden
                  className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-violet-tint to-transparent"
                />
                <span
                  aria-hidden
                  className="relative mx-auto grid h-[82px] w-[82px] place-items-center rounded-[28px] bg-gradient-to-br from-[#C4B5FD] to-[#6D28D9] text-[27px] font-bold text-white shadow-[0_14px_32px_rgba(109,40,217,0.24)]"
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
                      ratingState === 'loading'
                        ? 'กำลังโหลด…'
                        : ratingState === 'error'
                          ? 'โหลดคะแนนไม่ได้'
                          : averageRating === null
                            ? 'ยังไม่มีรีวิว'
                            : averageRating.toFixed(1)
                    }
                    muted={ratingState !== 'ready' || averageRating === null}
                  />
                  <ScoreCell
                    label="Blacklist Point"
                    value={String(MOCK_STATS.blacklistPoints)}
                  />
                </div>
              </aside>

              <section className="sl-surface p-6 sm:p-7">
                <h2 className="text-lg font-bold">ข้อมูลร้านค้า</h2>

                {isEditing ? (
                  <div className="mt-4 max-w-2xl">
                    <ShopForm
                      mode="edit"
                      profile={ready.profile}
                      shop={ready.shop}
                      token={ready.token}
                      refresh={refresh}
                      setPhoneSaveWarning={setPhoneSaveWarning}
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
                      // `||`, not `??`: clearing the textarea now sends `''`
                      // and the API stores it as-is, so a description that was
                      // emptied comes back as an empty string rather than null.
                      // The categories line below does the same for the same
                      // reason — `??` would render a blank row.
                      value={ready.shop.description || 'ยังไม่ระบุ'}
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
          </>
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
  setPhoneSaveWarning,
  options,
  optionsLoading,
  optionsError,
  onCancel,
}: {
  mode: 'create' | 'edit';
  profile: CurrentUser;
  shop: VendorShop | null;
  token: string;
  /** `refresh()` from `useVendorProfile()` — called once the shop write wins. */
  refresh: () => void;
  /**
   * Owned by `ProfileShopScreen` on purpose: a shop that saved while its phone
   * number did not has to stay on screen after this form is gone.
   */
  setPhoneSaveWarning: (message: string | null) => void;
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
    setPhoneSaveWarning(null);

    // Two endpoints, because the fields belong to two rows: the shop is
    // POST /shops or PATCH /shops/me, and the phone is PATCH /users/me on
    // `app_user`. They get a try/catch each rather than sharing one, because
    // only the first of them decides whether anything was saved. Under a shared
    // try, a phone write that failed after the shop had already been created
    // skipped `refresh()` and left the page on the create form — and the retry
    // it invited answered 409 for a shop that in fact existed, which reads as
    // "your save failed" when the save had won.
    //
    // `description` is sent as the trimmed string even when it is empty: the
    // DTO reads `''` as "clear it" and an omitted key as "leave it alone", so
    // `|| undefined` made the textarea impossible to empty once filled. `phone`
    // is the opposite case and is skipped entirely when blank — its DTO answers
    // 400 to an explicit null, and there is no "clear it" value to send.
    const payload = {
      name: name.trim(),
      description: description.trim(),
      categoryIds,
    };

    try {
      if (mode === 'create') {
        await createShop(payload, token);
      } else {
        await updateShop(payload, token);
      }
    } catch (cause) {
      setNotice(
        cause instanceof ApiError
          ? cause.message
          : 'เกิดข้อผิดพลาดที่ไม่คาดคิด กรุณาลองใหม่อีกครั้ง',
      );
      setIsSubmitting(false);
      return;
    }

    // The shop is saved from here on. Everything below runs whatever the phone
    // write does — a failure there is reported, it does not undo the save.
    if (trimmedPhone) {
      try {
        await updateMe({ phone: trimmedPhone }, token);
      } catch {
        setPhoneSaveWarning(
          'บันทึกข้อมูลร้านค้าแล้ว แต่บันทึกเบอร์โทรศัพท์ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง',
        );
      }
    }

    setIsSubmitting(false);
    refresh();
    // Editing closes back to the read-only card; the refreshed profile and
    // shop then arrive as props. Creating has nothing to close — the page
    // swaps to the shop card on its own once `refresh()` lands.
    if (mode === 'edit') onCancel?.();
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
