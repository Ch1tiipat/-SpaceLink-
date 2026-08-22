'use client';

import { useEffect, useRef, useState } from 'react';
import { Clock3 } from 'lucide-react';

type BookingCountdownProps = {
  expiresAt: string | null;
  active: boolean;
  onExpired?: () => void;
};

function secondsUntil(expiresAt: string | null): number {
  if (!expiresAt) return 0;
  return Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 1000));
}

export function BookingCountdown({
  expiresAt,
  active,
  onExpired,
}: BookingCountdownProps) {
  const [remainingSeconds, setRemainingSeconds] = useState(() =>
    active ? secondsUntil(expiresAt) : 0,
  );
  const notifiedRef = useRef(false);
  const onExpiredRef = useRef(onExpired);

  useEffect(() => {
    onExpiredRef.current = onExpired;
  }, [onExpired]);

  useEffect(() => {
    notifiedRef.current = false;

    if (!active || !expiresAt) {
      setRemainingSeconds(0);
      return;
    }

    function updateRemaining() {
      const remaining = secondsUntil(expiresAt);
      setRemainingSeconds(remaining);

      if (remaining === 0 && !notifiedRef.current) {
        notifiedRef.current = true;
        onExpiredRef.current?.();
      }
    }

    updateRemaining();
    const timer = window.setInterval(updateRemaining, 1000);
    return () => window.clearInterval(timer);
  }, [active, expiresAt]);

  if (!active) return null;

  if (remainingSeconds === 0) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-[#fff0ee] px-3 py-1.5 text-xs font-extrabold text-[#b42318]">
        <Clock3 className="h-3.5 w-3.5" aria-hidden />
        หมดเวลาชำระเงินแล้ว
      </span>
    );
  }

  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;

  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full bg-violet-tint px-3 py-1.5 text-xs font-extrabold tabular-nums text-violet"
      role="timer"
      aria-live="polite"
      aria-atomic="true"
    >
      <Clock3 className="h-3.5 w-3.5" aria-hidden />
      ชำระภายใน {minutes}:{seconds.toString().padStart(2, '0')} นาที
    </span>
  );
}
