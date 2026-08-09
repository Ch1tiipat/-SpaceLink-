'use client';

import type { CurrentUser, VendorShop } from '@/lib/api';

export type UxPreviewMode = 'signed-out' | 'signed-in';
export type UxPreviewShopMode = 'with-shop' | 'no-shop';

const STORAGE_KEY = 'spacelink:ux-preview-auth';
const CHANGE_EVENT = 'spacelink:ux-preview-change';
const SHOP_STORAGE_KEY = 'spacelink:ux-preview-shop';
const SHOP_CHANGE_EVENT = 'spacelink:ux-preview-shop-change';

export const UX_PREVIEW_TOKEN = 'local-ux-preview-token';

export const UX_PREVIEW_PROFILE: CurrentUser = {
  id: '00000000-0000-4000-8000-000000000051',
  authUserId: '00000000-0000-4000-8000-000000000052',
  email: 'review@spacelink.local',
  fullName: 'อรุณ คาเฟ่',
  phone: '081-234-5678',
  role: 'VENDOR',
  isBlacklisted: false,
  createdAt: '2026-08-01T03:00:00.000Z',
  updatedAt: '2026-08-08T03:00:00.000Z',
  shops: [],
};

export const UX_PREVIEW_SHOP: VendorShop = {
  id: '00000000-0000-4000-8000-000000000053',
  name: 'อรุณ คาเฟ่',
  description: 'กาแฟ เครื่องดื่ม และขนมโฮมเมดสำหรับงานอีเวนต์',
  logoUrl: null,
  categories: [{ id: 'cat-food', name: 'อาหารและเครื่องดื่ม' }],
};

/**
 * UX preview is deliberately restricted to the local development server.
 * It never replaces Supabase auth in a production build and never creates a
 * token that the API can accept.
 */
export function canUseUxPreview(): boolean {
  if (process.env.NODE_ENV !== 'development' || typeof window === 'undefined') {
    return false;
  }

  return window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost';
}

export function getUxPreviewMode(): UxPreviewMode | null {
  if (!canUseUxPreview()) return null;

  const requested = new URLSearchParams(window.location.search).get('uxAuth');
  if (requested === 'signed-in' || requested === 'signed-out') {
    window.localStorage.setItem(STORAGE_KEY, requested);
    return requested;
  }

  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === 'signed-in' || stored === 'signed-out') return stored;

  // When local auth has not been configured yet, begin in the safe guest
  // preview automatically so the reviewer can still use the switcher. A local
  // environment that already has Supabase configured continues to use its real
  // session until someone explicitly chooses a preview mode.
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    window.localStorage.setItem(STORAGE_KEY, 'signed-out');
    return 'signed-out';
  }

  return null;
}

export function setUxPreviewMode(mode: UxPreviewMode): void {
  if (!canUseUxPreview()) return;
  window.localStorage.setItem(STORAGE_KEY, mode);
  window.dispatchEvent(new CustomEvent<UxPreviewMode>(CHANGE_EVENT, { detail: mode }));
}

export function subscribeToUxPreview(
  listener: (mode: UxPreviewMode) => void,
): () => void {
  if (!canUseUxPreview()) return () => undefined;

  const handleChange = (event: Event) => {
    listener((event as CustomEvent<UxPreviewMode>).detail);
  };
  window.addEventListener(CHANGE_EVENT, handleChange);
  return () => window.removeEventListener(CHANGE_EVENT, handleChange);
}

export function getUxPreviewShopMode(): UxPreviewShopMode {
  if (!canUseUxPreview()) return 'with-shop';
  return window.localStorage.getItem(SHOP_STORAGE_KEY) === 'no-shop'
    ? 'no-shop'
    : 'with-shop';
}

export function setUxPreviewShopMode(mode: UxPreviewShopMode): void {
  if (!canUseUxPreview()) return;
  window.localStorage.setItem(SHOP_STORAGE_KEY, mode);
  window.dispatchEvent(
    new CustomEvent<UxPreviewShopMode>(SHOP_CHANGE_EVENT, { detail: mode }),
  );
}

export function subscribeToUxPreviewShop(
  listener: (mode: UxPreviewShopMode) => void,
): () => void {
  if (!canUseUxPreview()) return () => undefined;
  const handleChange = (event: Event) => {
    listener((event as CustomEvent<UxPreviewShopMode>).detail);
  };
  window.addEventListener(SHOP_CHANGE_EVENT, handleChange);
  return () => window.removeEventListener(SHOP_CHANGE_EVENT, handleChange);
}
