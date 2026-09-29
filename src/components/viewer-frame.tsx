"use client";

import { useRef, useState, type ReactNode } from "react";

/** Wraps the 3D viewer with a fullscreen toggle (§9). */
export function ViewerFrame({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [full, setFull] = useState(false);

  async function toggle() {
    if (!document.fullscreenElement) {
      await ref.current?.requestFullscreen?.();
      setFull(true);
    } else {
      await document.exitFullscreen?.();
      setFull(false);
    }
  }

  return (
    <div ref={ref} className="relative">
      {children}
      <button
        type="button"
        onClick={() => void toggle()}
        className="absolute right-3 top-3 z-10 flex items-center gap-1.5 rounded-full bg-black/45 px-3 py-1.5 text-[11px] font-semibold text-white backdrop-blur-sm transition-colors hover:bg-black/60"
      >
        {full ? "⤡ Exit" : "⛶ Fullscreen"}
      </button>
    </div>
  );
}
