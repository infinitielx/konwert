"use client";
import { useEffect, useState } from "react";

/** Current time in ms, updated every second. */
function useNow() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  return now;
}

function ago(from: number, now: number) {
  const s = Math.max(0, Math.floor((now - from) / 1000));
  if (s < 5) return "just now";
  if (s < 60) return `${s} sec ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ${s % 60} sec ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} h ${m % 60} min ago`;
  const d = Math.floor(h / 24);
  return `${d} d ${h % 24} h ago`;
}

/** How long ago an ISO timestamp was, relative to the current time. */
export function TimeAgo({ iso }: { iso: string }) {
  const now = useNow();
  // The server render and the first client render can differ by a second.
  return <span suppressHydrationWarning>{ago(new Date(iso).getTime(), now)}</span>;
}

/** Live clock in Indian Standard Time. */
export function LiveClock() {
  const now = useNow();
  return (
    <span suppressHydrationWarning>
      {new Date(now).toLocaleString("sv-SE", { timeZone: "Asia/Kolkata" })}
    </span>
  );
}
