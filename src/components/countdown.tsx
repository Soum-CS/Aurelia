"use client";

import { useEffect, useState } from "react";

export function Countdown({ targetISO, compact = false }: { targetISO: string; compact?: boolean }) {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setNow(Date.now()));
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      cancelAnimationFrame(raf);
      clearInterval(id);
    };
  }, []);

  if (now === null) {
    return <span className="inline-block h-8 w-40 animate-pulse rounded-lg bg-line align-middle" />;
  }

  const diff = Math.max(new Date(targetISO).getTime() - now, 0);
  const d = Math.floor(diff / 86_400_000);
  const h = Math.floor((diff % 86_400_000) / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  const s = Math.floor((diff % 60_000) / 1000);

  const cells = [
    { v: d, l: "days" },
    { v: h, l: "hrs" },
    { v: m, l: "min" },
    ...(compact ? [] : [{ v: s, l: "sec" }]),
  ];

  return (
    <div className="flex gap-2" role="timer" aria-label={`Time until check-in: ${d} days ${h} hours ${m} minutes`}>
      {cells.map((c) => (
        <div
          key={c.l}
          className="flex min-w-14 flex-col items-center rounded-xl border border-line bg-raised px-2 py-1.5"
        >
          <span className="font-display text-xl leading-none font-semibold tabular-nums">
            {String(c.v).padStart(2, "0")}
          </span>
          <span className="mt-1 text-[10px] tracking-[0.12em] uppercase opacity-60">{c.l}</span>
        </div>
      ))}
    </div>
  );
}
