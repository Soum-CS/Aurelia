"use client";

import { useEffect, useState } from "react";

export function SmartControls() {
  const [lights, setLights] = useState(70);
  const [temp, setTemp] = useState(21);
  const [curtains, setCurtains] = useState<"open" | "closed">("open");
  const [dnd, setDnd] = useState(false);
  const [synced, setSynced] = useState<string | null>(null);

  useEffect(() => {
    if (!synced) return;
    const id = setTimeout(() => setSynced(null), 1800);
    return () => clearTimeout(id);
  }, [synced]);

  function apply(label: string) {
    setSynced(`${label} — demo only, no device connected`);
  }

  return (
    <div className="space-y-5">
      <p
        className="rounded-xl px-3 py-2 text-[11px] font-bold tracking-wide uppercase"
        style={{ background: "#b07d2b1a", color: "#8a6217" }}
      >
        Demo · device integration not configured
      </p>
      <div>
        <div className="mb-2 flex items-center justify-between">
          <label htmlFor="lights" className="label !mb-0">Lighting</label>
          <span className="text-xs font-semibold tabular-nums" style={{ color: "var(--muted)" }}>
            {lights}%
          </span>
        </div>
        <input
          id="lights"
          type="range"
          min={0}
          max={100}
          value={lights}
          onChange={(e) => {
            setLights(Number(e.target.value));
          }}
          onMouseUp={() => apply(`Lighting ${lights}%`)}
          onTouchEnd={() => apply(`Lighting ${lights}%`)}
          onKeyUp={() => apply(`Lighting ${lights}%`)}
          className="w-full accent-[var(--accent)]"
        />
      </div>

      <div className="flex items-center justify-between gap-4">
        <span className="label !mb-0">Air conditioning</span>
        <div className="flex items-center gap-3">
          <button
            type="button"
            aria-label="Lower temperature"
            onClick={() => { setTemp((t) => Math.max(17, t - 1)); apply(`${Math.max(17, temp - 1)}°C`); }}
            className="focus-visible:outline-accent flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-line transition-colors hover:bg-raised focus-visible:outline-2"
          >
            −
          </button>
          <span className="font-display w-12 text-center text-xl font-semibold tabular-nums">{temp}°C</span>
          <button
            type="button"
            aria-label="Raise temperature"
            onClick={() => { setTemp((t) => Math.min(27, t + 1)); apply(`${Math.min(27, temp + 1)}°C`); }}
            className="focus-visible:outline-accent flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-line transition-colors hover:bg-raised focus-visible:outline-2"
          >
            +
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between gap-4">
        <span className="label !mb-0">Curtains</span>
        <div className="flex rounded-full border border-line p-1">
          {(["open", "closed"] as const).map((state) => (
            <button
              key={state}
              type="button"
              onClick={() => { setCurtains(state); apply(`Curtains ${state}`); }}
              aria-pressed={curtains === state}
              className={`cursor-pointer rounded-full px-4 py-1.5 text-xs font-semibold capitalize transition-colors ${
                curtains === state ? "" : "hover:opacity-80"
              }`}
              style={curtains === state ? { background: "var(--pine)", color: "var(--background)" } : undefined}
            >
              {state}
            </button>
          ))}
        </div>
      </div>

      <label className="flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-line px-4 py-3">
        <span>
          <span className="block text-sm font-semibold">Do not disturb</span>
          <span className="text-xs" style={{ color: "var(--muted)" }}>
            Housekeeping will skip the room
          </span>
        </span>
        <input
          type="checkbox"
          checked={dnd}
          onChange={(e) => { setDnd(e.target.checked); apply(e.target.checked ? "Do not disturb on" : "Do not disturb off"); }}
          className="h-5 w-9 appearance-none rounded-full bg-line transition-colors before:block before:h-4 before:w-4 before:translate-x-0.5 before:rounded-full before:bg-white before:shadow before:transition-transform checked:bg-accent checked:before:translate-x-[18px]"
        />
      </label>

      <p role="status" className="h-5 text-center text-xs font-medium" style={{ color: "var(--pine)" }} aria-live="polite">
        {synced ?? ""}
      </p>
    </div>
  );
}
