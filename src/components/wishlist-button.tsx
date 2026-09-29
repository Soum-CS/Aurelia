"use client";

import { useState } from "react";

export function WishlistButton({
  hotelId,
  initialSaved,
  size = "md",
}: {
  hotelId: string;
  initialSaved: boolean;
  size?: "sm" | "md";
}) {
  const [saved, setSaved] = useState(initialSaved);
  const [busy, setBusy] = useState(false);

  async function toggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (busy) return;
    setBusy(true);
    const next = !saved;
    setSaved(next);
    try {
      const res = await fetch("/api/wishlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hotelId }),
      });
      if (!res.ok) setSaved(!next);
    } catch {
      setSaved(!next);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={saved ? "Remove from wishlist" : "Save to wishlist"}
      aria-pressed={saved}
      className={`focus-visible:outline-accent absolute top-3 right-3 z-10 flex cursor-pointer items-center justify-center rounded-full border backdrop-blur-sm transition-all hover:scale-110 focus-visible:outline-2 focus-visible:outline-offset-2 ${
        size === "sm" ? "h-8 w-8" : "h-9 w-9"
      }`}
      style={{
        background: saved ? "#b03a2e" : "rgba(0,0,0,0.35)",
        borderColor: saved ? "#b03a2e" : "rgba(255,255,255,0.4)",
        color: "#fff",
      }}
    >
      <svg
        viewBox="0 0 24 24"
        width={size === "sm" ? 14 : 16}
        height={size === "sm" ? 14 : 16}
        fill={saved ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M19 14c1.5-1.5 3-3.2 3-5.2A4.8 4.8 0 0 0 17.2 4c-1.7 0-3 .9-4.2 2.1L12 7l-1-1C9.8 4.9 8.5 4 6.8 4A4.8 4.8 0 0 0 2 8.8c0 2 1.5 3.7 3 5.2l7 6.5Z" />
      </svg>
    </button>
  );
}
