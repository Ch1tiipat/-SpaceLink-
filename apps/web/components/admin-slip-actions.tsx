'use client';

import { Download, Eye, LoaderCircle, X } from 'lucide-react';
import { useState } from 'react';
import { getAdminBookingSlipAccess } from '@/lib/api';
import { getSupabaseBrowserClient } from '@/lib/supabase';

type SlipAction = 'view' | 'download';

export function AdminSlipActions({
  bookingId,
  disabled = false,
}: {
  bookingId: string;
  disabled?: boolean;
}) {
  const [loading, setLoading] = useState<SlipAction | null>(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [error, setError] = useState('');

  async function requestAccess(action: SlipAction) {
    if (loading || disabled) return;
    setLoading(action);
    setError('');

    try {
      const token = await getAccessToken();
      const access = await getAdminBookingSlipAccess(bookingId, token);

      if (action === 'view') {
        setPreviewUrl(access.viewUrl);
        return;
      }

      const anchor = document.createElement('a');
      anchor.href = access.downloadUrl;
      anchor.rel = 'noopener noreferrer';
      anchor.referrerPolicy = 'no-referrer';
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'ไม่สามารถเปิดสลิปได้',
      );
    } finally {
      setLoading(null);
    }
  }

  function closePreview() {
    setPreviewUrl('');
  }

  return (
    <>
      <div className="flex min-w-[150px] flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void requestAccess('view')}
          disabled={disabled || loading !== null}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#d9ccef] bg-white px-3 text-xs font-extrabold text-[#6d35d3] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading === 'view' ? (
            <LoaderCircle className="h-3.5 w-3.5 animate-spin" aria-hidden />
          ) : (
            <Eye className="h-3.5 w-3.5" aria-hidden />
          )}
          ดูสลิป
        </button>
        <button
          type="button"
          onClick={() => void requestAccess('download')}
          disabled={disabled || loading !== null}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#d9ccef] bg-[#f8f4ff] px-3 text-xs font-extrabold text-[#6d35d3] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading === 'download' ? (
            <LoaderCircle className="h-3.5 w-3.5 animate-spin" aria-hidden />
          ) : (
            <Download className="h-3.5 w-3.5" aria-hidden />
          )}
          ดาวน์โหลด
        </button>
        {error ? (
          <span className="basis-full text-[11px] font-bold text-[#b42318]">
            {error}
          </span>
        ) : null}
      </div>

      {previewUrl ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="ดูสลิปการชำระเงิน"
          className="fixed inset-0 z-[100] flex items-center justify-center bg-[#17121fcc]/75 p-4"
          onClick={closePreview}
        >
          <div
            className="relative flex max-h-[92vh] w-full max-w-3xl flex-col rounded-2xl bg-white p-4 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-black text-[#242032]">
                  สลิปการชำระเงิน
                </h2>
                <p className="text-xs text-[#82788b]">
                  ลิงก์นี้มีอายุ 5 นาทีและไม่ได้เก็บถาวร
                </p>
              </div>
              <button
                type="button"
                onClick={closePreview}
                aria-label="ปิดหน้าต่างดูสลิป"
                className="grid h-10 w-10 place-items-center rounded-full border border-[#e7dfea] text-[#62576c]"
              >
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>
            {/* The URL is an ephemeral private Supabase URL, so it cannot be
                declared as a stable Next Image remote host. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewUrl}
              alt="หลักฐานการชำระเงิน"
              className="min-h-0 w-full flex-1 rounded-xl bg-[#f7f3fa] object-contain"
              referrerPolicy="no-referrer"
            />
          </div>
        </div>
      ) : null}
    </>
  );
}

async function getAccessToken(): Promise<string> {
  const {
    data: { session },
  } = await getSupabaseBrowserClient().auth.getSession();
  if (!session?.access_token) {
    throw new Error('กรุณาเข้าสู่ระบบใหม่');
  }
  return session.access_token;
}
