"use client";

import { Html } from "@react-three/drei";
import { useState } from "react";

export function Hotspot({
  position,
  label,
  active,
  onSelect,
}: {
  position: [number, number, number];
  label: string;
  active: boolean;
  onSelect: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <Html position={position} center distanceFactor={8} zIndexRange={[15, 0]}>
      <div className="relative flex items-center justify-center">
        {/* Pulsing ring */}
        <button
          type="button"
          onClick={onSelect}
          onPointerEnter={() => setHovered(true)}
          onPointerLeave={() => setHovered(false)}
          onFocus={() => setHovered(true)}
          onBlur={() => setHovered(false)}
          aria-label={`Inspect feature: ${label}`}
          aria-pressed={active}
          className="group relative flex h-8 w-8 cursor-pointer items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-white"
        >
          <span
            className={`absolute inline-flex h-full w-full rounded-full transition-all ${
              active
                ? "bg-[#c9a25e]/60 animate-ping"
                : hovered
                ? "bg-[#c9a25e]/40 scale-125"
                : "bg-black/25"
            }`}
          />
          <span
            className={`relative flex h-5 w-5 items-center justify-center rounded-full border-2 shadow-lg transition-all ${
              active
                ? "scale-110 border-white bg-[#c9a25e] ring-2 ring-[#c9a25e]/50"
                : hovered
                ? "scale-125 border-white bg-[#c9a25e]"
                : "border-white bg-black/60 backdrop-blur-sm"
            }`}
          >
            <span className="text-[10px] font-bold leading-none text-white">+</span>
          </span>
        </button>

        {/* Hover label tooltip pill */}
        {(hovered || active) && (
          <div
            className="pointer-events-none absolute bottom-9 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full border border-white/20 bg-black/75 px-2.5 py-1 text-[11px] font-medium tracking-wide text-white shadow-xl backdrop-blur-md transition-all animate-fade-up"
            role="tooltip"
          >
            {label}
          </div>
        )}
      </div>
    </Html>
  );
}
