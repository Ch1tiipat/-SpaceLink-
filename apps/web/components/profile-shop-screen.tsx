'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  BadgeCheck,
  Bell,
  BellOff,
  CircleAlert,
  ImageUp,
  Layers3,
  LoaderCircle,
  Mail,
  Package,
  Phone,
  Star,
  Store,
  UserRound,
  type LucideIcon,
} from 'lucide-react';
import { MultiSelectMenu } from '@/components/multi-select-menu';
import type { SelectMenuOption } from '@/components/select-menu';
import {
  ApiError,
  createPushSubscription,
  createShop,
  deletePushSubscription,
  getAverageRating,
  getCategories,
  updateMe,
  updateShop,
  uploadShopLogo,
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
 * Both limits mirror ShopLogoStorageService, which re-checks them from the
 * file's own bytes. Checking here as well is a courtesy, not the enforcement
 * (§14.6): it turns a rejected file into an instant Thai message instead of an
 * upload that travels to the server before failing.
 */
const MAX_LOGO_FILE_SIZE = 2 * 1024 * 1024;
const MAX_LOGO_DIMENSION = 2000;
const ACCEPTED_LOGO_TYPES = new Set(['image/jpeg', 'image/png']);

/**
 * Resolves `null` when the bytes cannot be decoded as an image — the same
 * "reject rather than skip the check" posture the API takes for a header it
 * cannot parse.
 */
function readImageDimensions(
  file: File,
): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve({ width: image.naturalWidth, height: image.naturalHeight });
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(null);
    };
    image.src = objectUrl;
  });
}

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

            <section className="sl-surface relative mt-8 overflow-hidden p-6 sm:p-7">
              <span
                aria-hidden
                className="absolute inset-y-0 right-0 w-1/2 bg-[radial-gradient(circle_at_70%_30%,rgba(124,58,237,0.13),transparent_65%)]"
              />
              <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center">
                <span
                  aria-hidden
                  className="absolute -left-10 -top-14 h-40 w-40 rounded-full bg-violet-tint blur-3xl"
                />
                <ShopLogoUploader
                  shop={ready.shop}
                  token={ready.token}
                  refresh={refresh}
                />
                <div className="min-w-0 flex-1">
                  <span className="inline-flex rounded-full bg-violet-tint px-3 py-1 text-sm font-extrabold uppercase tracking-[.12em] text-violet">
                    Vendor profile
                  </span>
                  <h2 className="mt-3 truncate text-2xl font-black tracking-[-0.035em] text-ink">
                    {ready.shop.name}
                  </h2>
                  <p className="mt-1 text-sm font-bold text-muted">
                    {ready.profile.fullName}
                  </p>
                  <p className="mt-1 truncate text-xs text-muted">
                    {ready.profile.email}
                  </p>
                </div>
                <span
                  className={`inline-flex items-center gap-2 self-start rounded-full px-3 py-2 text-xs font-extrabold sm:self-center ${
                    ready.profile.isBlacklisted
                      ? 'bg-[#fff0ee] text-[#b42318]'
                      : 'bg-[#ebfaf3] text-[#13795b]'
                  }`}
                >
                  {ready.profile.isBlacklisted ? (
                    <CircleAlert className="h-4 w-4" aria-hidden />
                  ) : (
                    <BadgeCheck className="h-4 w-4" aria-hidden />
                  )}
                  {ready.profile.isBlacklisted
                    ? 'บัญชีถูกระงับ'
                    : 'บัญชีพร้อมใช้งาน'}
                </span>
              </div>
            </section>

            {ready.profile.isBlacklisted && (
              <p
                role="alert"
                className="mt-4 flex items-start gap-3 rounded-2xl border border-[#fac5bf] bg-[#fff0ee] px-5 py-4 text-sm leading-6 text-[#b42318]"
              >
                <CircleAlert className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
                บัญชีนี้ถูกระงับการใช้งาน การดำเนินการบางอย่างอาจไม่พร้อมใช้งาน กรุณาติดต่อผู้ดูแลระบบ
              </p>
            )}

            <PushNotificationCard token={ready.token} />

            <section
              className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4"
              aria-label="สรุปโปรไฟล์ร้านค้า"
            >
              <ProfileStat
                icon={Star}
                label="คะแนนร้านค้า"
                value={
                  ratingState === 'loading'
                    ? 'กำลังโหลด…'
                    : ratingState === 'error'
                      ? 'โหลดไม่ได้'
                      : averageRating === null
                        ? 'ยังไม่มีรีวิว'
                        : `${averageRating.toFixed(1)} / 5`
                }
              />
              <ProfileStat
                icon={Layers3}
                label="หมวดสินค้า"
                value={`${ready.shop.categories.length} หมวด`}
              />
              <ProfileStat
                icon={Phone}
                label="ข้อมูลติดต่อ"
                value={ready.profile.phone ? 'พร้อมใช้งาน' : 'ยังไม่ระบุ'}
                tone={ready.profile.phone ? 'green' : 'amber'}
              />
              <ProfileStat
                icon={ready.profile.isBlacklisted ? CircleAlert : BadgeCheck}
                label="สถานะบัญชี"
                value={ready.profile.isBlacklisted ? 'ถูกระงับ' : 'พร้อมใช้งาน'}
                tone={ready.profile.isBlacklisted ? 'danger' : 'green'}
              />
            </section>

            <section className="sl-surface mt-5 p-6 sm:p-7">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
                <div>
                  <span className="sl-kicker">Shop information</span>
                  <h2 className="mt-2 text-lg font-bold">ข้อมูลร้านค้า</h2>
                </div>
                {!isEditing && (
                  <div className="flex flex-wrap gap-2">
                    <Link href="/bookings" className="sl-chip text-violet">
                      การจองของฉัน
                    </Link>
                    <button
                      type="button"
                      onClick={() => setIsEditing(true)}
                      className="sl-chip text-violet"
                    >
                      แก้ไขข้อมูล
                    </button>
                  </div>
                )}
              </div>

              {isEditing ? (
                <div className="mt-5 max-w-2xl">
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
                <dl className="mt-5 grid gap-4 sm:grid-cols-2">
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
          </>
        )}
      </div>
    </main>
  );
}

type PushAvailability =
  | 'checking'
  | 'ready'
  | 'denied'
  | 'unsupported'
  | 'unconfigured';

function urlBase64ToUint8Array(value: string) {
  const padding = '='.repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/');
  const bytes = window.atob(base64);
  return Uint8Array.from(bytes, (character) => character.charCodeAt(0));
}

function subscriptionKeyToBase64(subscription: PushSubscription, name: PushEncryptionKeyName) {
  const key = subscription.getKey(name);
  if (!key) return '';
  const bytes = new Uint8Array(key);
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return window.btoa(binary);
}

function PushNotificationCard({ token }: { token: string }) {
  const [availability, setAvailability] = useState<PushAvailability>('checking');
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    void (async () => {
      if (
        !('Notification' in window) ||
        !('serviceWorker' in navigator) ||
        !('PushManager' in window)
      ) {
        if (active) setAvailability('unsupported');
        return;
      }

      if (Notification.permission === 'denied') {
        if (active) setAvailability('denied');
        return;
      }

      if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) {
        if (active) setAvailability('unconfigured');
        return;
      }

      let registration = await navigator.serviceWorker.getRegistration();
      if (!registration && process.env.NODE_ENV === 'production') {
        registration = await navigator.serviceWorker.ready;
      }
      if (!active) return;
      if (!registration) {
        setAvailability('unsupported');
        return;
      }

      const subscription = await registration.pushManager.getSubscription();
      if (!active) return;
      setSubscribed(Boolean(subscription));
      setAvailability('ready');
    })().catch(() => {
      if (active) setAvailability('unsupported');
    });

    return () => {
      active = false;
    };
  }, []);

  async function handleToggle() {
    if (availability !== 'ready' || busy) return;
    setBusy(true);
    setMessage(null);

    try {
      const registration = await navigator.serviceWorker.ready;
      const existing = await registration.pushManager.getSubscription();

      if (subscribed) {
        if (existing) {
          const endpoint = existing.endpoint;
          await existing.unsubscribe();
          setSubscribed(false);
          await deletePushSubscription(endpoint, token);
        }
        setSubscribed(false);
        setMessage('ปิดการแจ้งเตือนบนอุปกรณ์นี้แล้ว');
        return;
      }

      const permission = await Notification.requestPermission();
      if (permission === 'denied') {
        setAvailability('denied');
        return;
      }
      if (permission !== 'granted') {
        setMessage('ยังไม่ได้อนุญาตการแจ้งเตือน');
        return;
      }

      const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidPublicKey) {
        setAvailability('unconfigured');
        return;
      }

      const subscription =
        existing ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
        }));

      const p256dh = subscriptionKeyToBase64(subscription, 'p256dh');
      const auth = subscriptionKeyToBase64(subscription, 'auth');
      if (!p256dh || !auth) {
        if (!existing) await subscription.unsubscribe();
        throw new Error('เบราว์เซอร์ไม่สามารถสร้างกุญแจสำหรับการแจ้งเตือนได้');
      }

      try {
        await createPushSubscription(
          {
            endpoint: subscription.endpoint,
            expirationTime: subscription.expirationTime,
            keys: { p256dh, auth },
          },
          token,
        );
      } catch (cause) {
        if (!existing) await subscription.unsubscribe();
        throw cause;
      }

      setSubscribed(true);
      setMessage('เปิดการแจ้งเตือนบนอุปกรณ์นี้แล้ว');
    } catch (cause) {
      setMessage(
        cause instanceof ApiError || cause instanceof Error
          ? cause.message
          : 'เปลี่ยนการตั้งค่าการแจ้งเตือนไม่สำเร็จ',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="sl-surface mt-4 p-5 sm:p-6" aria-labelledby="push-notification-title">
      <div className="flex items-start gap-4">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-violet-tint text-violet">
          {availability === 'denied' ? (
            <BellOff className="h-5 w-5" aria-hidden />
          ) : (
            <Bell className="h-5 w-5" aria-hidden />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <h2 id="push-notification-title" className="font-bold text-ink">
            เปิดการแจ้งเตือนบนอุปกรณ์นี้
          </h2>
          <p className="mt-1 text-sm leading-6 text-muted">
            รับข่าวการจอง การชำระเงิน และประกาศสำคัญ แม้ไม่ได้เปิดหน้า SpaceLink อยู่
          </p>
        </div>

        {availability === 'ready' || availability === 'denied' || availability === 'unconfigured' ? (
          <button
            type="button"
            role="switch"
            aria-checked={subscribed}
            aria-label="เปิดการแจ้งเตือนบนอุปกรณ์นี้"
            onClick={handleToggle}
            disabled={busy || availability !== 'ready'}
            className={`relative mt-1 h-7 w-12 shrink-0 rounded-full transition disabled:cursor-wait disabled:opacity-60 ${
              subscribed ? 'bg-violet' : 'bg-[#d8d2df]'
            }`}
          >
            <span
              className={`absolute top-1 grid h-5 w-5 place-items-center rounded-full bg-white shadow-sm transition ${
                subscribed ? 'left-6' : 'left-1'
              }`}
            >
              {busy ? <LoaderCircle className="h-3 w-3 animate-spin" aria-hidden /> : null}
            </span>
          </button>
        ) : null}
      </div>

      {availability === 'checking' ? (
        <p className="mt-3 text-xs text-muted">กำลังตรวจสอบอุปกรณ์…</p>
      ) : null}
      {availability === 'denied' ? (
        <p role="alert" className="mt-3 text-sm text-[#b42318]">
          เบราว์เซอร์ปิดสิทธิ์แจ้งเตือนไว้ กรุณาเปิดสิทธิ์ของเว็บไซต์นี้ในการตั้งค่าเบราว์เซอร์
        </p>
      ) : null}
      {availability === 'unsupported' ? (
        <p className="mt-3 text-sm text-muted">
          เบราว์เซอร์หรือโหมดที่ใช้อยู่ยังไม่รองรับการแจ้งเตือนแบบ Push
        </p>
      ) : null}
      {availability === 'unconfigured' ? (
        <p role="status" className="mt-3 text-sm text-muted">
          การแจ้งเตือนบนอุปกรณ์ยังไม่พร้อมใช้งาน
        </p>
      ) : null}
      {message ? (
        <p role="status" className="mt-3 text-sm font-bold text-violet">
          {message}
        </p>
      ) : null}
    </section>
  );
}

/**
 * The shop avatar and the control that replaces it, together — the preview a
 * vendor needs before uploading *is* the avatar, so keeping them apart would
 * mean rendering the same square twice.
 *
 * Only reachable once a shop exists: the object path is keyed by shop id, so
 * there is nothing to attach a logo to on the create form.
 */
function ShopLogoUploader({
  shop,
  token,
  refresh,
}: {
  shop: VendorShop;
  token: string;
  /** `refresh()` from `useVendorProfile()` — brings back the new `logoUrl`. */
  refresh: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Revoked on the way out: an object URL pins the whole file in memory until
  // it is released, and a vendor may pick several before settling on one.
  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  function reject(message: string, input: HTMLInputElement) {
    setFile(null);
    setError(message);
    input.value = '';
  }

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const input = event.target;
    const selected = input.files?.[0] ?? null;
    setError(null);

    if (!selected) {
      setFile(null);
      return;
    }

    if (!ACCEPTED_LOGO_TYPES.has(selected.type)) {
      reject('รองรับเฉพาะไฟล์ JPEG หรือ PNG เท่านั้น', input);
      return;
    }
    if (selected.size > MAX_LOGO_FILE_SIZE) {
      reject('ไฟล์โลโก้ต้องมีขนาดไม่เกิน 2 MB', input);
      return;
    }

    const dimensions = await readImageDimensions(selected);
    if (!dimensions) {
      reject('ไม่สามารถอ่านไฟล์รูปภาพนี้ได้ กรุณาเลือกไฟล์อื่น', input);
      return;
    }
    if (
      dimensions.width > MAX_LOGO_DIMENSION ||
      dimensions.height > MAX_LOGO_DIMENSION
    ) {
      reject(
        `รูปโลโก้ต้องมีความกว้างและความสูงไม่เกิน ${MAX_LOGO_DIMENSION} พิกเซล (ไฟล์นี้ ${dimensions.width}×${dimensions.height})`,
        input,
      );
      return;
    }

    setFile(selected);
  }

  async function handleUpload() {
    if (!file || isUploading) return;

    setIsUploading(true);
    setError(null);

    try {
      await uploadShopLogo(file, token);
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? cause.message
          : 'เกิดข้อผิดพลาดที่ไม่คาดคิด กรุณาลองใหม่อีกครั้ง',
      );
      setIsUploading(false);
      return;
    }

    setIsUploading(false);
    // Clearing the picked file drops the local preview, so the square falls
    // back to `shop.logoUrl` — which `refresh()` is about to replace with the
    // URL that was just stored. Its `?v=` differs every upload, so the browser
    // fetches the new file instead of the cached one.
    setFile(null);
    if (inputRef.current) inputRef.current.value = '';
    refresh();
  }

  const shownLogoUrl = previewUrl ?? shop.logoUrl;

  return (
    <div className="relative">
      {shownLogoUrl ? (
        /* eslint-disable-next-line @next/next/no-img-element --
           next/image would route this through the optimizer, which needs the
           Supabase host in `images.remotePatterns` — and that host comes from
           an env var, so it is not known at build time. `zone-map.tsx` renders
           the same URL raw for the same reason. */
        <img
          src={shownLogoUrl}
          alt={`โลโก้ของ ${shop.name}`}
          width={82}
          height={82}
          className="relative mx-auto block h-[82px] w-[82px] rounded-[28px] object-cover shadow-[0_14px_32px_rgba(109,40,217,0.24)]"
        />
      ) : (
        <span
          aria-hidden
          className="relative mx-auto grid h-[82px] w-[82px] place-items-center rounded-[28px] bg-gradient-to-br from-[#C4B5FD] to-[#6D28D9] text-[27px] font-bold text-white shadow-[0_14px_32px_rgba(109,40,217,0.24)]"
        >
          {[...shop.name.trim()][0] ?? '?'}
        </span>
      )}

      <div className="mt-3">
        <label
          htmlFor="shop-logo"
          className="inline-flex cursor-pointer items-center gap-1.5 text-[13px] font-bold text-violet"
        >
          <ImageUp aria-hidden className="h-4 w-4" strokeWidth={2} />
          {shop.logoUrl ? 'เปลี่ยนโลโก้' : 'เพิ่มโลโก้ร้าน'}
        </label>
        <input
          ref={inputRef}
          id="shop-logo"
          type="file"
          accept="image/jpeg,image/png"
          disabled={isUploading}
          onChange={handleFileChange}
          className="mt-2 block w-full text-base text-ink file:mr-2 file:rounded-lg file:border-0 file:bg-[#ede7ff] file:px-3 file:py-1.5 file:text-sm file:font-bold file:text-violet hover:file:bg-[#e3d9ff] disabled:cursor-not-allowed disabled:opacity-60"
        />
        <p className="mt-1.5 text-sm leading-4 text-muted">
          JPEG หรือ PNG ไม่เกิน 2 MB และไม่เกิน {MAX_LOGO_DIMENSION}×
          {MAX_LOGO_DIMENSION} พิกเซล
        </p>
      </div>

      {error && (
        <p
          role="alert"
          className="mt-2 rounded-xl bg-[#fff4f6] px-3 py-2 text-left text-sm leading-4 text-danger"
        >
          {error}
        </p>
      )}

      {file && (
        <button
          type="button"
          onClick={handleUpload}
          disabled={isUploading}
          className="mt-2.5 w-full rounded-xl bg-violet px-4 py-2 text-[13px] font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {isUploading ? 'กำลังอัปโหลด…' : 'บันทึกโลโก้'}
        </button>
      )}
    </div>
  );
}

function ProfileStat({
  icon: Icon,
  label,
  value,
  tone = 'violet',
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  tone?: 'violet' | 'green' | 'amber' | 'danger';
}) {
  const tones = {
    violet: 'bg-violet-tint text-violet',
    green: 'bg-[#ebfaf3] text-[#13795b]',
    amber: 'bg-[#fff8e8] text-[#895b08]',
    danger: 'bg-[#fff0ee] text-[#b42318]',
  } as const;

  return (
    <article className="sl-soft-surface flex min-w-0 items-center gap-3 p-4 sm:p-5">
      <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ${tones[tone]}`}>
        <Icon className="h-5 w-5" aria-hidden />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-bold text-muted">{label}</p>
        <p className="mt-1 truncate text-sm font-extrabold text-ink">{value}</p>
      </div>
    </article>
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

    const normalizedPhone = phone.replace(/[\s-]/g, '');
    const nextNameError = name.trim() ? null : 'กรุณากรอกชื่อร้าน';
    const nextCategoryError =
      categoryIds.length > 0 ? null : 'กรุณาเลือกหมวดสินค้าอย่างน้อย 1 หมวด';
    const nextPhoneError =
      normalizedPhone && !THAI_PHONE_PATTERN.test(normalizedPhone)
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
    if (normalizedPhone) {
      try {
        await updateMe({ phone: normalizedPhone }, token);
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
          className={`w-full rounded-xl border bg-white px-4 py-3 text-base outline-none ${
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
          className="w-full rounded-xl border border-line bg-white px-4 py-3 text-base outline-none"
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
          className={`w-full rounded-xl border bg-white px-4 py-3 text-base outline-none ${
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
          className="w-full rounded-xl border border-line bg-[#F7F5FA] px-4 py-3 text-base text-muted outline-none"
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
