"use client";

import { useEffect, useState } from "react";

interface DigitalKeyProps {
  code: string;
  guestName: string;
  hotelName: string;
  roomName: string;
  roomNumber?: string | null;
  validFrom: string | Date;
  validUntil: string | Date;
}

export function DigitalRoomKey({
  code,
  guestName,
  hotelName,
  roomName,
  roomNumber,
  validFrom,
  validUntil,
}: DigitalKeyProps) {
  const [unlocked, setUnlocked] = useState(false);
  const [pulsing, setPulsing] = useState(false);
  const [activeKey, setActiveKey] = useState<{
    keyToken: string;
    roomNumber: string;
  } | null>(null);

  useEffect(() => {
    fetch(`/api/keys/${code}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && data.keyToken) {
          setActiveKey({
            keyToken: data.keyToken,
            roomNumber: data.roomNumber,
          });
        }
      })
      .catch(() => {});
  }, [code]);

  async function handleTapToUnlock() {
    setPulsing(true);
    try {
      const res = await fetch(`/api/keys/${code}`, { method: "POST" });
      if (res.ok) {
        setUnlocked(true);
        setTimeout(() => setUnlocked(false), 4000);
      }
    } catch {
      // Offline simulation fallback
      setUnlocked(true);
      setTimeout(() => setUnlocked(false), 4000);
    } finally {
      setTimeout(() => setPulsing(false), 800);
    }
  }

  const roomDisplay = activeKey?.roomNumber ?? roomNumber ?? "Signature Suite";

  return (
    <div className="mx-auto w-full max-w-sm">
      {/* Luxury Metallic Key Card */}
      <div className="relative aspect-[1.586/1] w-full overflow-hidden rounded-3xl border border-amber-400/30 bg-gradient-to-br from-stone-900 via-neutral-900 to-black p-6 text-white shadow-2xl">
        {/* Ambient Gold Radial Glow */}
        <div
          aria-hidden
          className="pointer-events-none absolute -right-12 -top-12 h-44 w-44 rounded-full bg-amber-500/20 blur-3xl"
        />

        <div className="relative flex h-full flex-col justify-between">
          {/* Card Header */}
          <div className="flex items-start justify-between">
            <div>
              <span className="text-xl text-amber-300">⚜️</span>
              <p className="mt-1 font-display text-sm font-semibold tracking-wider text-amber-200">
                {hotelName}
              </p>
            </div>
            <div className="flex items-center gap-1.5 rounded-full border border-amber-300/30 bg-black/40 px-2.5 py-1 text-[10px] font-semibold tracking-widest text-amber-300 uppercase">
              <span>●</span> NFC Ready
            </div>
          </div>

          {/* Card Center: Room Number */}
          <div className="text-center my-auto">
            <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-neutral-400">
              Assigned Suite
            </span>
            <h3 className="font-display text-2xl font-bold tracking-tight text-amber-100 sm:text-3xl">
              {roomDisplay}
            </h3>
            <p className="mt-0.5 text-xs text-neutral-400">{roomName}</p>
          </div>

          {/* Card Footer: Guest & Validity */}
          <div className="flex items-end justify-between text-xs border-t border-white/10 pt-3">
            <div>
              <span className="text-[9px] uppercase tracking-wider text-neutral-500">Keyholder</span>
              <p className="font-semibold text-neutral-200">{guestName}</p>
            </div>
            <div className="text-right">
              <span className="text-[9px] uppercase tracking-wider text-neutral-500">Access Window</span>
              <p className="font-mono text-[11px] text-amber-200">
                {new Date(validFrom).toLocaleDateString("en-US", { month: "short", day: "numeric" })} –{" "}
                {new Date(validUntil).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Tap-To-Unlock Interaction */}
      <div className="mt-5 text-center">
        <button
          type="button"
          onClick={handleTapToUnlock}
          disabled={pulsing}
          className={`relative mx-auto flex h-16 w-16 items-center justify-center rounded-full border-2 transition-all ${
            unlocked
              ? "border-emerald-500 bg-emerald-500/20 text-emerald-400 shadow-lg shadow-emerald-500/30"
              : pulsing
              ? "border-amber-400 bg-amber-400/20 text-amber-300 scale-95"
              : "border-accent bg-raised text-accent hover:scale-105 shadow-md"
          }`}
        >
          {unlocked ? (
            <span className="text-2xl">🔓</span>
          ) : (
            <span className="text-2xl">{pulsing ? "📡" : "🔑"}</span>
          )}
        </button>

        <p className="mt-2 text-xs font-semibold text-foreground">
          {unlocked
            ? "Suite Door Unlocked · Welcome Inside"
            : pulsing
            ? "Transmitting Contactless Token…"
            : "Tap to Unlock Suite Door"}
        </p>
        <p className="mt-0.5 text-[11px] text-muted">
          Contactless reader compatible. Hold device against the suite door lock or tap above.
        </p>
      </div>
    </div>
  );
}
