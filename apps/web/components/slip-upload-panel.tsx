'use client';

import { ChangeEvent, FormEvent, useRef, useState } from 'react';
import {
  CheckCircle2,
  FileImage,
  ShieldCheck,
  UploadCloud,
} from 'lucide-react';

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
    <section className="sl-surface p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-violet-tint text-violet">
          <UploadCloud className="h-5 w-5" aria-hidden />
        </span>
        <div className="space-y-1">
        <h2 className="text-lg font-extrabold text-ink">แนบหลักฐานการชำระเงิน</h2>
        <p className="text-sm leading-6 text-muted">
          เลือกรูปสลิป JPEG หรือ PNG ขนาดไม่เกิน 5 MB ระบบจะตรวจสอบสลิป
          โดยอัตโนมัติ
        </p>
        </div>
      </div>

      <ol className="mt-5 grid grid-cols-3 gap-2" aria-label="ขั้นตอนตรวจสลิป">
        {['เลือกไฟล์', 'ตรวจสอบสลิป', 'ยืนยันการจอง'].map((label, index) => (
          <li
            key={label}
            className="rounded-xl bg-[#faf8ff] px-2 py-2.5 text-center text-sm font-extrabold text-muted sm:text-xs"
          >
            <span className="mr-1 text-violet">{index + 1}</span>
            {label}
          </li>
        ))}
      </ol>

      <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
        <div>
          <label
            className="mb-2 block text-sm font-medium text-ink"
            htmlFor={`slip-${bookingId}`}
          >
            รูปสลิปการโอนเงิน
          </label>
          <div className="rounded-[20px] border border-dashed border-[#cfc3e8] bg-[#faf8ff] p-3 transition focus-within:border-violet focus-within:bg-white">
            <input
              ref={inputRef}
              id={`slip-${bookingId}`}
              type="file"
              accept="image/jpeg,image/png"
              disabled={disabled || isUploading}
              onChange={handleFileChange}
              className="block w-full text-base text-ink file:mr-4 file:rounded-xl file:border-0 file:bg-[#ede7ff] file:px-4 file:py-2.5 file:font-bold file:text-violet hover:file:bg-[#e3d9ff] disabled:cursor-not-allowed disabled:opacity-60"
            />
          </div>
          {file ? (
            <div className="mt-3 flex items-center gap-3 rounded-2xl border border-[#d8ccef] bg-violet-tint p-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white text-violet shadow-sm">
                <FileImage className="h-5 w-5" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-extrabold text-ink">
                  {file.name}
                </p>
                <p className="mt-0.5 text-xs text-muted">
                  {formatFileSize(file.size)} · พร้อมอัปโหลด
                </p>
              </div>
              <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald" aria-hidden />
            </div>
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
          className="sl-action-primary w-full"
        >
          <ShieldCheck className="h-4 w-4" aria-hidden />
          {isUploading ? 'กำลังอัปโหลดและตรวจสอบ…' : 'อัปโหลดสลิป'}
        </button>
        <p className="flex items-center justify-center gap-1.5 text-center text-sm leading-5 text-muted">
          <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-emerald" aria-hidden />
          ระบบใช้ไฟล์นี้เพื่อตรวจสอบการชำระเงินของการจองรายการนี้เท่านั้น
        </p>
      </form>
    </section>
  );
}
