"use client";

import { useEffect, useId, useRef, useState } from "react";

export interface SelectedPlace {
  label: string;
  latitude?: number;
  longitude?: number;
}

interface Suggestion extends SelectedPlace {
  id: string;
  kind: string;
  source: "worldwide" | "fallback";
}

type DetectState =
  | { phase: "idle" }
  | { phase: "locating" }
  | { phase: "error"; message: string };

const DEBOUNCE_MS = 300;
const MIN_CHARS = 2;

function MagnifierIcon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden className="shrink-0 opacity-55">
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

function PinIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden className={`shrink-0 ${className}`}>
      <path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

/**
 * Worldwide destination autocomplete.
 * Top row: 📍 Use my current location (browser Geolocation + reverse
 * geocoding). Below: debounced search across cities, regions, countries,
 * destinations and addresses — nothing hardcoded, nothing restricted to
 * a predefined city list.
 */
export function LocationAutocomplete({
  value,
  onValueChange,
  onSelect,
}: {
  value: string;
  onValueChange: (text: string) => void;
  /** Fired when a concrete place is picked (current location or suggestion). */
  onSelect: (place: SelectedPlace | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [source, setSource] = useState<"worldwide" | "fallback" | null>(null);
  const [loading, setLoading] = useState(false);
  const [detect, setDetect] = useState<DetectState>({ phase: "idle" });
  const [activeIndex, setActiveIndex] = useState(-1); // -1 = current-location row
  const [justPicked, setJustPicked] = useState(false);

  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const listboxId = useId();

  // close on outside interaction
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!wrapperRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  // debounced worldwide suggestions
  useEffect(() => {
    if (justPicked) return;
    const text = value.trim();
    if (open && text.length >= MIN_CHARS) {
      const t = setTimeout(async () => {
        setLoading(true);
        abortRef.current?.abort();
        const ac = new AbortController();
        abortRef.current = ac;
        try {
          const res = await fetch(`/api/geo/search?q=${encodeURIComponent(text)}`, {
            signal: ac.signal,
          });
          const data = (await res.json()) as { places: Suggestion[]; source: typeof source };
          setSuggestions(data.places ?? []);
          setSource(data.source ?? null);
          setActiveIndex(-1);
        } catch {
          if (!ac.signal.aborted) {
            setSuggestions([]);
            setSource(null);
          }
        } finally {
          if (!ac.signal.aborted) setLoading(false);
        }
      }, DEBOUNCE_MS);
      return () => clearTimeout(t);
    }
    const raf = requestAnimationFrame(() => {
      setLoading(false);
      setSuggestions([]);
    });
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, open]);

  function pick(place: SelectedPlace) {
    setJustPicked(true);
    setOpen(false);
    setDetect({ phase: "idle" });
    onValueChange(place.label);
    onSelect(place);
    window.setTimeout(() => setJustPicked(false), 400);
  }

  async function detectCurrentLocation() {
    if (!("geolocation" in navigator)) {
      setDetect({
        phase: "error",
        message: "Geolocation is not supported by your browser.",
      });
      return;
    }

    // Discard old coordinates before requesting fresh location
    setDetect({ phase: "locating" });

    const gpsOptions: PositionOptions = {
      enableHighAccuracy: true,
      timeout: 20000,
      maximumAge: 0,
    };

    function attemptPosition(isRetry = false) {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const { latitude, longitude, accuracy } = pos.coords;
          const timestamp = pos.timestamp;
          console.log("REAL GPS RESULT", {
            latitude,
            longitude,
            accuracy,
            timestamp,
            age: Date.now() - timestamp,
          });
          console.log("GPS latitude:", latitude);
          console.log("GPS longitude:", longitude);
          console.log("GPS accuracy:", accuracy);
          console.log("GPS timestamp:", timestamp);

          // Direct fetch to hotel search pipeline with fresh GPS coordinates
          fetch(`/api/hotels?lat=${latitude}&lng=${longitude}`).catch(() => {});

          try {
            const res = await fetch(`/api/geo/reverse?lat=${latitude}&lng=${longitude}`);
            const data = (await res.json()) as {
              place: { label: string; name?: string; region?: string; country?: string } | null;
              notice?: string;
            };
            if (data.place?.label) {
              pick({
                label: data.place.label,
                latitude,
                longitude,
              });
              setDetect({ phase: "idle" });
            } else {
              // Real coordinates remain available even if place lookup fails
              pick({
                label: `Current GPS location detected: ${latitude.toFixed(4)}, ${longitude.toFixed(4)} (Address lookup temporarily unavailable)`,
                latitude,
                longitude,
              });
              setDetect({ phase: "idle" });
            }
          } catch {
            pick({
              label: `Current GPS location detected: ${latitude.toFixed(4)}, ${longitude.toFixed(4)} (Address lookup temporarily unavailable)`,
              latitude,
              longitude,
            });
            setDetect({ phase: "idle" });
          }
        },
        (err) => {
          // If GPS times out: retry GPS once using high accuracy
          if ((err.code === 3 || err.code === err.TIMEOUT) && !isRetry) {
            console.log("GPS detection timed out. Retrying once with high accuracy...");
            attemptPosition(true);
            return;
          }

          let message = "An unexpected error occurred while detecting your location. Please try again.";
          if (err.code === err.PERMISSION_DENIED) {
            message = "Location permission was denied. Please enable location access for Aurelia in your browser/device settings.";
          } else if (err.code === err.POSITION_UNAVAILABLE) {
            message = "Your current location could not be determined. Please check your device location/GPS settings and try again.";
          } else if (err.code === err.TIMEOUT) {
            message = "Location detection timed out. Please try again in an area with better GPS access.";
          }
          setDetect({ phase: "error", message });
        },
        gpsOptions
      );
    }

    attemptPosition(false);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      setOpen(false);
      return;
    }
    if (!open && (e.key === "ArrowDown" || e.key === "Enter")) {
      setOpen(true);
      e.preventDefault();
      return;
    }
    if (!open) return;
    const rowCount = suggestions.length + 1; // + current-location row
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, rowCount - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, -1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (activeIndex === -1) void detectCurrentLocation();
      else {
        const s = suggestions[activeIndex - 1];
        if (s)
          pick({
            label: s.label,
            latitude: Number.isFinite(s.latitude) ? s.latitude : undefined,
            longitude: Number.isFinite(s.longitude) ? s.longitude : undefined,
          });
      }
    }
  }

  const showPanel = open;

  return (
    <div ref={wrapperRef} className="relative">
      <label htmlFor="dest" className="label">
        Destination
      </label>
      <div
        role="combobox"
        aria-expanded={showPanel}
        aria-haspopup="listbox"
        aria-controls={listboxId}
      >
        <input
          ref={inputRef}
          id="dest"
          className="input pr-9"
          placeholder="Search city, destination or country…"
          autoComplete="off"
          value={value}
          role="searchbox"
          aria-autocomplete="list"
          onChange={(e) => {
            onValueChange(e.target.value);
            onSelect(null);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
        />
        <button
          type="button"
          tabIndex={-1}
          aria-label="Use my current location"
          onClick={() => {
            setOpen(true);
            void detectCurrentLocation();
          }}
          className={`focus-visible:outline-accent absolute top-[2.05rem] right-2 flex h-7 w-7 cursor-pointer items-center justify-center rounded-full transition-colors hover:bg-raised focus-visible:outline-2 ${
            detect.phase === "locating" ? "animate-pulse" : ""
          }`}
          style={{ color: "var(--accent)" }}
        >
          <PinIcon />
        </button>
      </div>

      {showPanel && (
        <ul
          ref={listRef}
          id={listboxId}
          role="listbox"
          aria-label="Destination suggestions"
          className="animate-fade-up absolute top-full right-0 left-0 z-30 mt-2 overflow-hidden rounded-2xl border shadow-xl"
          style={{
            background: "var(--surface-raised)",
            borderColor: "var(--line)",
            boxShadow: "0 24px 48px -20px rgb(var(--shadow-color) / 0.45)",
          }}
        >
          {/* current location */}
          <li role="option" aria-selected={false} data-active={activeIndex === -1 || undefined}>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => void detectCurrentLocation()}
              onMouseEnter={() => setActiveIndex(-1)}
              className="flex w-full cursor-pointer items-center gap-2.5 px-4 py-3 text-left text-sm font-medium transition-colors hover:bg-raised"
              style={
                activeIndex === -1
                  ? { background: "color-mix(in srgb, var(--accent) 10%, transparent)" }
                  : undefined
              }
            >
              {detect.phase === "locating" ? (
                <span
                  aria-hidden
                  className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent"
                  style={{ color: "var(--accent)" }}
                />
              ) : (
                <PinIcon className="text-accent" />
              )}
              <span>
                {detect.phase === "locating" ? "Detecting your location…" : "Use my current location"}
              </span>
            </button>
          </li>

          {detect.phase === "error" && (
            <li
              role="status"
              className="border-t px-4 py-2.5 text-xs leading-relaxed"
              style={{ borderColor: "var(--line)", color: "#b03a2e" }}
            >
              {detect.message}
            </li>
          )}

          {/* suggestions */}
          {loading && (
            <li aria-hidden className="space-y-2 border-t px-4 py-3" style={{ borderColor: "var(--line)" }}>
              {[0, 1, 2].map((i) => (
                <div key={i} className="skeleton h-4" style={{ width: `${88 - i * 18}%` }} />
              ))}
            </li>
          )}

          {!loading &&
            suggestions.map((s, i) => (
              <li key={s.id} role="option" aria-selected={false}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() =>
                    pick({
                      label: s.label,
                      latitude: Number.isFinite(s.latitude) ? s.latitude : undefined,
                      longitude: Number.isFinite(s.longitude) ? s.longitude : undefined,
                    })
                  }
                  onMouseEnter={() => setActiveIndex(i + 1)}
                  className="flex w-full cursor-pointer items-center gap-2.5 border-t px-4 py-3 text-left text-sm transition-colors hover:bg-raised"
                  style={{
                    borderColor: "var(--line)",
                    background:
                      activeIndex === i + 1
                        ? "color-mix(in srgb, var(--accent) 10%, transparent)"
                        : undefined,
                  }}
                >
                  <MagnifierIcon />
                  <span className="min-w-0 truncate">{s.label}</span>
                  {s.kind !== "hotel-city" && (
                    <span
                      className="ml-auto shrink-0 rounded-full px-2 py-0.5 text-[10px] tracking-wide uppercase"
                      style={{ color: "var(--muted)", background: "var(--background)" }}
                    >
                      {s.kind.replace(/_/g, " ")}
                    </span>
                  )}
                </button>
              </li>
            ))}

          {!loading && value.trim().length < MIN_CHARS && (
            <li
              className="border-t px-4 py-3 text-xs"
              style={{ borderColor: "var(--line)", color: "var(--muted)" }}
            >
              Type to search any city, region or destination worldwide.
            </li>
          )}

          {!loading && value.trim().length >= MIN_CHARS && suggestions.length === 0 && detect.phase !== "error" && (
            <li
              className="border-t px-4 py-3 text-xs"
              style={{ borderColor: "var(--line)", color: "var(--muted)" }}
            >
              No matches for “{value.trim()}” — press Search to look stays by name.
            </li>
          )}

          {source === "fallback" && suggestions.length > 0 && (
            <li
              className="border-t px-4 py-2 text-[11px]"
              style={{ borderColor: "var(--line)", color: "var(--muted)" }}
            >
              Worldwide search is offline — showing Aurelia destinations.
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
