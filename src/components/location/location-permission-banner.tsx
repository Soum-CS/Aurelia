"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { reverseGeocode } from "@/lib/geocoding";
import { getLocationPrivacySettings, saveLocationPrivacySettings } from "@/lib/location/privacy-service";

export function LocationPermissionBanner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [dismissed, setDismissed] = useState(false);
  const [locating, setLocating] = useState(false);
  const [manualInputOpen, setManualInputOpen] = useState(false);
  const [cityQuery, setCityQuery] = useState("");
  const [currentCityName, setCurrentCityName] = useState<string | null>(null);

  const hasLocation = searchParams.has("lat") && searchParams.has("lng");
  const lat = searchParams.get("lat");
  const lng = searchParams.get("lng");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const isDismissed = sessionStorage.getItem("aurelia_loc_banner_dismissed");
      if (isDismissed) setDismissed(true);
    }
  }, []);

  useEffect(() => {
    if (lat && lng) {
      const latitude = Number.parseFloat(lat);
      const longitude = Number.parseFloat(lng);
      if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
        reverseGeocode(latitude, longitude).then((place) => {
          if (place) {
            setCurrentCityName(place.name || place.label);
          }
        });
      }
    }
  }, [lat, lng]);

  const [locError, setLocError] = useState<string | null>(null);

  function applyLocation(latitude: number, longitude: number, accuracy: number, timestamp: number) {
    setLocating(false);
    setLocError(null);
    setDismissed(true);
    if (typeof window !== "undefined") {
      sessionStorage.setItem("aurelia_loc_banner_dismissed", "1");
    }
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
    // Immediately reverse-geocode fresh GPS coordinates
    reverseGeocode(latitude, longitude).then((place) => {
      if (place) {
        setCurrentCityName(place.name || place.label);
      }
    });

    // Direct fetch to hotel search pipeline with fresh GPS coordinates
    fetch(`/api/hotels?lat=${latitude}&lng=${longitude}`).catch(() => {});

    const p = new URLSearchParams(searchParams.toString());
    p.set("lat", String(latitude));
    p.set("lng", String(longitude));
    p.delete("radius");
    p.delete("q");
    p.delete("place");
    p.delete("city");
    p.delete("state");
    p.delete("search");
    router.push(`/?${p.toString()}#stays`);
  }

  function handleAllowLocation() {
    if (typeof window === "undefined" || !("geolocation" in navigator)) {
      setLocError("Geolocation is not supported by your browser.");
      return;
    }

    setLocError(null);
    setLocating(true);
    saveLocationPrivacySettings({ enabled: true });

    const gpsOptions: PositionOptions = {
      enableHighAccuracy: true,
      timeout: 20000,
      maximumAge: 0,
    };

    function attemptPosition(isRetry = false) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          applyLocation(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy, pos.timestamp);
        },
        (err) => {
          // If GPS times out: retry GPS once using high accuracy
          if ((err.code === 3 || err.code === err.TIMEOUT) && !isRetry) {
            console.log("GPS detection timed out. Retrying once with high accuracy...");
            attemptPosition(true);
            return;
          }

          setLocating(false);
          let errorMsg = "An unexpected error occurred while detecting your location. Please try again.";
          if (err.code === 1 || err.code === err.PERMISSION_DENIED) {
            errorMsg = "Location permission was denied. Please enable location access for Aurelia in your browser/device settings.";
          } else if (err.code === 2 || err.code === err.POSITION_UNAVAILABLE) {
            errorMsg = "Your current location could not be determined. Please check your device location/GPS settings and try again.";
          } else if (err.code === 3 || err.code === err.TIMEOUT) {
            errorMsg = "Location detection timed out. Please try again in an area with better GPS access.";
          }
          setLocError(errorMsg);
        },
        gpsOptions
      );
    }

    attemptPosition(false);
  }

  function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault();
    const q = cityQuery.trim();
    if (!q) return;
    setDismissed(true);
    if (typeof window !== "undefined") {
      sessionStorage.setItem("aurelia_loc_banner_dismissed", "1");
    }
    const p = new URLSearchParams(searchParams.toString());
    p.delete("lat");
    p.delete("lng");
    p.delete("radius");
    p.delete("place");
    p.delete("city");
    p.delete("state");
    p.delete("search");
    p.set("q", q);
    router.push(`/?${p.toString()}#stays`);
  }

  function handleDismiss() {
    setDismissed(true);
    if (typeof window !== "undefined") {
      sessionStorage.setItem("aurelia_loc_banner_dismissed", "1");
    }
  }

  if (dismissed || hasLocation) return null;

  return (
    <div
      role="region"
      aria-label="Location services invitation"
      className="animate-fade-up mx-auto mb-6 w-full max-w-3xl rounded-3xl border border-line bg-raised/95 p-5 shadow-xl backdrop-blur-md sm:p-6"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3.5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-accent/15 text-xl text-accent">
            📍
          </div>
          <div>
            <h3 className="font-display text-lg font-semibold tracking-tight text-foreground">
              Discover Aurelia Around You
            </h3>
            <p className="mt-1 text-xs leading-relaxed sm:text-sm" style={{ color: "var(--muted)" }}>
              Allow location access to discover luxury hotels, fine dining, curated experiences, and private airport transfers near you.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
          <button
            type="button"
            onClick={handleAllowLocation}
            disabled={locating}
            className="btn-primary !py-2 !px-4 text-xs font-semibold"
          >
            {locating ? "Locating…" : "Allow Location"}
          </button>
          <button
            type="button"
            onClick={() => setManualInputOpen((v) => !v)}
            className="btn-secondary !py-2 !px-4 text-xs font-semibold"
          >
            Enter Manually
          </button>
          <button
            type="button"
            onClick={handleDismiss}
            aria-label="Dismiss location banner"
            className="rounded-full p-2 text-muted transition-colors hover:bg-background hover:text-foreground"
          >
            ✕
          </button>
        </div>
      </div>

      {locError && (
        <div className="mt-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300 font-medium whitespace-pre-line flex items-center justify-between gap-2">
          <span>⚠️ {locError}</span>
          <button
            type="button"
            onClick={handleAllowLocation}
            className="rounded-lg bg-amber-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-amber-700"
          >
            Retry
          </button>
        </div>
      )}

      {manualInputOpen && (
        <form onSubmit={handleManualSubmit} className="mt-4 flex items-center gap-2 border-t border-line pt-4">
          <input
            type="text"
            className="input !py-2 text-xs sm:text-sm"
            placeholder="Enter city or destination (e.g. Bengaluru, Mumbai, Goa, Paris)"
            value={cityQuery}
            onChange={(e) => setCityQuery(e.target.value)}
            autoFocus
          />
          <button type="submit" className="btn-primary !py-2 shrink-0 text-xs font-semibold">
            Search
          </button>
        </form>
      )}
    </div>
  );
}
