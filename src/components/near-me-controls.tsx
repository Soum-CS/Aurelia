"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const RADII = [5, 10, 25];

type GeoFailure = "denied" | "unavailable" | "timeout" | "unsupported" | null;

const FAILURE_COPY: Record<Exclude<GeoFailure, null>, string> = {
  denied: "Location permission was denied. Please enable location access for Aurelia in your browser/device settings.",
  unavailable: "Your current location could not be determined. Please check your device location/GPS settings and try again.",
  timeout: "Location detection timed out. Please try again in an area with better GPS access.",
  unsupported: "Geolocation is not supported by your browser.",
};

/**
 * "Near me" uses the browser's real GPS/Wi-Fi coordinates — never a hardcoded
 * or IP-guessed default. On first open we politely ask once per session; if
 * geolocation fails for any reason we surface an explicit "enter your city"
 * input instead of silently falling back.
 */
export function NearMeControls({
  cities,
  autoLocate = false,
}: {
  cities: string[];
  autoLocate?: boolean;
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const [locating, setLocating] = useState(false);
  const [failure, setFailure] = useState<GeoFailure>(null);
  const [cityDraft, setCityDraft] = useState("");
  const autoTried = useRef(false);

  const hasLocation = sp.has("lat") && sp.has("lng");
  const radius = Number(sp.get("radius") ?? 25);

  function pushParams(mutate: (p: URLSearchParams) => void) {
    const params = new URLSearchParams(sp.toString());
    mutate(params);
    router.push(`/?${params.toString()}#stays`);
  }

  function locate() {
    setFailure(null);
    if (!("geolocation" in navigator)) {
      setFailure("unsupported");
      return;
    }

    setLocating(true);

    const gpsOptions: PositionOptions = {
      enableHighAccuracy: true,
      timeout: 20000,
      maximumAge: 0,
    };

    function attemptPosition(isRetry = false) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLocating(false);
          setFailure(null);
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

          pushParams((p) => {
            p.set("lat", String(latitude));
            p.set("lng", String(longitude));
            // no implicit radius: show everything, sorted nearest first —
            // visitors opt into a distance cap with the radius chips
            p.delete("radius");
            p.delete("q");
            p.delete("place");
            p.delete("city");
            p.delete("state");
            p.delete("search");
          });
        },
        (err) => {
          // If GPS times out: retry GPS once using high accuracy
          if ((err.code === 3 || err.code === err.TIMEOUT) && !isRetry) {
            console.log("GPS detection timed out. Retrying once with high accuracy...");
            attemptPosition(true);
            return;
          }

          setLocating(false);
          setFailure(
            err.code === err.PERMISSION_DENIED
              ? "denied"
              : err.code === err.POSITION_UNAVAILABLE
                ? "unavailable"
                : "timeout"
          );
        },
        gpsOptions
      );
    }

    attemptPosition(false);
  }

  // ask once per session when landing with no location and no query
  useEffect(() => {
    if (!autoLocate || autoTried.current || hasLocation || sp.get("q") || sp.get("place")) return;
    autoTried.current = true;
    if (sessionStorage.getItem("aurelia_geo_asked")) return;
    sessionStorage.setItem("aurelia_geo_asked", "1");
    void (async () => locate())();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoLocate]);

  function searchCity(e: React.FormEvent) {
    e.preventDefault();
    const city = cityDraft.trim();
    if (!city) return;
    setFailure(null);
    setCityDraft("");
    pushParams((p) => {
      p.delete("lat");
      p.delete("lng");
      p.delete("radius");
      p.delete("place");
      p.delete("city");
      p.delete("state");
      p.delete("search");
      p.set("q", city);
    });
  }

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={locate}
        disabled={locating}
        className="focus-visible:outline-accent flex cursor-pointer items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold transition-colors hover:bg-raised focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-60"
        style={{
          borderColor: hasLocation ? "var(--accent)" : "var(--line)",
          color: hasLocation ? "var(--accent)" : "var(--ink)",
        }}
      >
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
          <circle cx="12" cy="12" r="3" />
          <path d="M12 2v3m0 14v3M2 12h3m14 0h3" />
          <circle cx="12" cy="12" r="8" opacity="0.35" />
        </svg>
        {locating ? "Finding hotels near you…" : hasLocation ? "Location on" : "Use My Current Location"}
      </button>

      {hasLocation && (
        <span className="text-[11px]" style={{ color: "var(--muted)" }}>
          using your device location · nearest first
        </span>
      )}

      {hasLocation &&
        RADII.map((r) => (
          <button
            key={r}
            type="button"
            onClick={() =>
              pushParams((p) => {
                p.set("radius", String(r));
              })
            }
            aria-pressed={radius === r}
            className={`cursor-pointer rounded-full border px-3 py-2 text-xs font-semibold transition-colors ${
              radius === r ? "" : "hover:bg-raised"
            }`}
            style={
              radius === r
                ? { background: "var(--accent)", color: "var(--on-accent)", borderColor: "transparent" }
                : { borderColor: "var(--line)" }
            }
          >
            Within {r} km
          </button>
        ))}

      {hasLocation && (
        <button
          type="button"
          onClick={() =>
            pushParams((p) => {
              p.delete("lat");
              p.delete("lng");
              p.delete("radius");
            })
          }
          className="cursor-pointer rounded-full px-3 py-2 text-xs underline underline-offset-2 opacity-70 hover:opacity-100"
        >
          Clear location
        </button>
      )}

      {/* explicit fallback: never guess a default city */}
      {failure && (
        <form onSubmit={searchCity} role="search" className="flex w-full items-center gap-2 sm:w-auto">
          <span role="status" className="text-xs" style={{ color: "#b03a2e" }}>
            {FAILURE_COPY[failure]}
          </span>
          <label htmlFor="nearme-city" className="sr-only">
            Enter your city
          </label>
          <input
            id="nearme-city"
            list="nearme-city-options"
            value={cityDraft}
            onChange={(e) => setCityDraft(e.target.value)}
            placeholder="Enter your city"
            className="input !w-auto flex-1 !rounded-full !px-4 !py-1.5 text-xs sm:flex-none"
            autoFocus
          />
          <datalist id="nearme-city-options">
            {cities.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
          <button type="submit" className="btn-primary !px-4 !py-1.5 text-xs">
            Search
          </button>
        </form>
      )}
    </div>
  );
}
