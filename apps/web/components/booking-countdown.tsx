'use client';

import { useEffect, useRef, useState } from 'react';

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
    return <span className="font-bold text-[#b42318]">หมดเวลาชำระเงินแล้ว</span>;
  }

  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;

  return (
    <span className="font-bold text-violet" role="timer" aria-live="polite">
      เหลือเวลา {minutes}:{seconds.toString().padStart(2, '0')} นาที
    </span>
  );
}
