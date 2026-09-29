import { isLiveInventory } from "@/lib/hotel-provider";

/**
 * Honest provenance labeling (spec §43/§62): live provider data vs the
 * seeded demo collection. Never rendered as decoration — every surface that
 * shows hotels, rooms or prices carries it.
 */
export function DataSourceBadge({ compact = false }: { compact?: boolean }) {
  if (isLiveInventory()) {
    return (
      <span
        className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold tracking-wide"
        style={{
          background: "color-mix(in srgb, var(--pine) 14%, transparent)",
          color: "var(--pine)",
        }}
        title="Availability and rates come from the connected hotel inventory provider"
      >
        <span aria-hidden className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60" style={{ background: "var(--pine)" }} />
          <span className="relative inline-flex h-2 w-2 rounded-full" style={{ background: "var(--pine)" }} />
        </span>
        Live availability
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold tracking-wide"
      style={{
        background: "color-mix(in srgb, #b8860b 16%, transparent)",
        color: "#8a6508",
      }}
      title="No live hotel API is configured — this content comes from Aurelia's seeded demo collection"
    >
      <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
        <path d="M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
      </svg>
      {compact ? "Demo data" : "DEMO DATA — LIVE HOTEL API NOT CONNECTED"}
    </span>
  );
}
