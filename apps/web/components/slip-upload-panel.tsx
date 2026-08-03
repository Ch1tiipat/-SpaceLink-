'use client';

import { ChangeEvent, FormEvent, useRef, useState } from 'react';

import {
  ApiError,
  SlipUploadResponse,
  uploadBookingSlip,
} from '@/lib/api';

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ACCEPTED_TYPES = new Set(['image/jpeg', 'image/png']);

type SlipUploadPanelProps = {
  bookingId: string;
  token: string;
  disabled?: boolean;
  onResult?: (response: SlipUploadResponse) => void;
  onConfirmed?: (response: SlipUploadResponse) => void;
};

function formatFileSize(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function SlipUploadPanel({
  bookingId,
  token,
  disabled = false,
  onResult,
  onConfirmed,
}: SlipUploadPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SlipUploadResponse | null>(null);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0] ?? null;
    setError(null);
    setResult(null);

    if (!selected) {
      setFile(null);
      return;
    }

    if (!ACCEPTED_TYPES.has(selected.type)) {
      setFile(null);
      setError('รองรับเฉพาะไฟล์ JPEG หรือ PNG เท่านั้น');
      event.target.value = '';
      return;
    }

    if (selected.size > MAX_FILE_SIZE) {
      setFile(null);
      setError('ไฟล์ต้องมีขนาดไม่เกิน 5 MB');
      event.target.value = '';
      return;
    }

    setFile(selected);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!file || disabled || isUploading) return;

    setIsUploading(true);
    setError(null);
    setResult(null);

    try {
      const response = await uploadBookingSlip(bookingId, file, token);
      setResult(response);
      onResult?.(response);

      if (response.booking.status === 'CONFIRMED') {
        onConfirmed?.(response);
      }

      setFile(null);
      if (inputRef.current) inputRef.current.value = '';
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? cause.message
          : 'เกิดข้อผิดพลาดที่ไม่คาดคิด กรุณาลองใหม่อีกครั้ง',
      );
    } finally {
      setIsUploading(false);
    }
  };

  const isConfirmed = result?.booking.status === 'CONFIRMED';

  return (
    <section className="rounded-3xl border border-line bg-white p-5 shadow-soft sm:p-6">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-ink">แนบหลักฐานการชำระเงิน</h2>
        <p className="text-sm leading-6 text-muted">
          เลือกรูปสลิป JPEG หรือ PNG ขนาดไม่เกิน 5 MB ระบบจะตรวจสอบสลิป
          โดยอัตโนมัติ
        </p>
      </div>

      <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
        <div>
          <label
            className="mb-2 block text-sm font-medium text-ink"
            htmlFor={`slip-${bookingId}`}
          >
            รูปสลิปการโอนเงิน
          </label>
          <input
            ref={inputRef}
            id={`slip-${bookingId}`}
            type="file"
            accept="image/jpeg,image/png"
            disabled={disabled || isUploading}
            onChange={handleFileChange}
            className="block w-full rounded-2xl border border-line bg-mist px-4 py-3 text-sm text-ink file:mr-4 file:rounded-xl file:border-0 file:bg-[#ede7ff] file:px-4 file:py-2 file:font-medium file:text-violet hover:file:bg-[#e3d9ff] disabled:cursor-not-allowed disabled:opacity-60"
          />
          {file ? (
            <p className="mt-2 text-xs text-muted">
              เลือกแล้ว: {file.name} ({formatFileSize(file.size)})
            </p>
          ) : null}
        </div>

        {error ? (
          <div
            className="rounded-2xl border border-[#f1c6d0] bg-[#fff4f6] px-4 py-3 text-sm text-danger"
            role="alert"
          >
            {error}
          </div>
        ) : null}

        {result ? (
          <div
            className={`rounded-2xl border px-4 py-3 text-sm ${
              isConfirmed
                ? 'border-[#b9dfd3] bg-[#effaf6] text-emerald'
                : 'border-[#f1d6a6] bg-[#fff9ed] text-[#895b08]'
            }`}
            role="status"
          >
            <p className="font-semibold">
              {isConfirmed
                ? 'ตรวจสอบสำเร็จและยืนยันการจองแล้ว'
                : 'ระบบยังไม่สามารถยืนยันสลิปได้'}
            </p>
            <p className="mt-1">{result.verification.message}</p>
          </div>
        ) : null}

        <button
          type="submit"
          disabled={!file || disabled || isUploading}
          className="inline-flex min-h-11 w-full items-center justify-center rounded-2xl bg-violet px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#5e2fd5] focus:outline-none focus:ring-2 focus:ring-violet focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {isUploading ? 'กำลังอัปโหลดและตรวจสอบ…' : 'อัปโหลดสลิป'}
        </button>
      </form>
    </section>
  );
}
