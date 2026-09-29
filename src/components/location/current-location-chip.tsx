"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { reverseGeocode } from "@/lib/geocoding";
import { saveLocationPrivacySettings } from "@/lib/location/privacy-service";

export function CurrentLocationChip() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [cityName, setCityName] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [manualCity, setManualCity] = useState("");
  const [locating, setLocating] = useState(false);
  const [locError, setLocError] = useState<string | null>(null);
  const [gpsStatus, setGpsStatus] = useState<"idle" | "requesting" | "success" | "timeout" | "permission-denied" | "position-unavailable" | "error">("idle");
  const [currentGpsLocation, setCurrentGpsLocation] = useState<{
    latitude: number;
    longitude: number;
    accuracy: number;
    timestamp: number;
  } | null>(null);

  const lat = searchParams.get("lat");
  const lng = searchParams.get("lng");
  const q = searchParams.get("q");

  useEffect(() => {
    if (lat && lng) {
      const latitude = Number.parseFloat(lat);
      const longitude = Number.parseFloat(lng);
      if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
        reverseGeocode(latitude, longitude).then((place) => {
          if (place) {
            setCityName(place.name || place.label.split(",")[0] || place.label);
          } else {
            setCityName(`${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
          }
        });
      }
    } else if (q) {
      setCityName(q);
    } else {
      setCityName(null);
    }
  }, [lat, lng, q]);

  function applyLocation(latitude: number, longitude: number, accuracy: number, timestamp: number) {
    setLocating(false);
    setLocError(null);
    setModalOpen(false);
    setGpsStatus("success");
    const gps = { latitude, longitude, accuracy, timestamp };
    setCurrentGpsLocation(gps);

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

    // Immediately reverse-geocode fresh GPS coordinates for the chip label
    reverseGeocode(latitude, longitude).then((place) => {
      if (place) {
        setCityName(place.name || place.label.split(",")[0] || place.label);
      } else {
        setCityName(`${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
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

  function handleUseCurrentLocation() {
    if (typeof window === "undefined" || !("geolocation" in navigator)) {
      setGpsStatus("error");
      setLocError("Geolocation is not supported by your browser.");
      return;
    }

    // Clear old location before requesting GPS
    setCurrentGpsLocation(null);
    setLocError(null);
    setGpsStatus("requesting");
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
          setCurrentGpsLocation(null);
          let errorMsg = "An unexpected error occurred while detecting your location. Please try again.";
          if (err.code === 1 || err.code === err.PERMISSION_DENIED) {
            setGpsStatus("permission-denied");
            errorMsg = "Location permission was denied. Please enable location access for Aurelia in your browser/device settings.";
          } else if (err.code === 2 || err.code === err.POSITION_UNAVAILABLE) {
            setGpsStatus("position-unavailable");
            errorMsg = "Your current location could not be determined. Please check your device location/GPS settings and try again.";
          } else if (err.code === 3 || err.code === err.TIMEOUT) {
            setGpsStatus("timeout");
            errorMsg = "Location detection timed out. Please try again in an area with better GPS access.";
          } else {
            setGpsStatus("error");
          }
          setLocError(errorMsg);
        },
        gpsOptions
      );
    }

    attemptPosition(false);
  }

  function handleManualCitySubmit(e: React.FormEvent) {
    e.preventDefault();
    const city = manualCity.trim();
    if (!city) return;
    setModalOpen(false);
    setManualCity("");
    const p = new URLSearchParams(searchParams.toString());
    p.delete("lat");
    p.delete("lng");
    p.delete("radius");
    p.delete("place");
    p.delete("city");
    p.delete("state");
    p.delete("search");
    p.set("q", city);
    router.push(`/?${p.toString()}#stays`);
  }

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-2 rounded-full border border-line bg-raised/80 px-3.5 py-1.5 text-xs font-medium shadow-sm backdrop-blur-md">
        <span className="text-accent" aria-hidden>📍</span>
        <span style={{ color: "var(--muted)" }}>
          {gpsStatus === "success" ? "Current Location:" : "Location:"}
        </span>
        <span className="font-semibold text-foreground">
          {cityName ?? "Worldwide"}
        </span>

        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="ml-1 text-[11px] font-semibold text-accent underline underline-offset-2 hover:opacity-80"
        >
          Change
        </button>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="animate-fade-up w-full max-w-md rounded-3xl border border-line bg-raised p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg font-semibold">Change Location</h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-full p-1.5 text-muted hover:bg-background hover:text-foreground"
              >
                ✕
              </button>
            </div>

            <p className="mt-1 text-xs sm:text-sm" style={{ color: "var(--muted)" }}>
              Explore hotels, 3D rooms, airport transfers, and experiences anywhere in the world.
            </p>

            <button
              type="button"
              onClick={handleUseCurrentLocation}
              disabled={locating}
              className="btn-primary mt-4 w-full justify-center !py-2.5 text-xs font-semibold"
            >
              {locating ? "Detecting your current location…" : "📍 Use Current GPS Location"}
            </button>

            {gpsStatus === "requesting" && (
              <div className="mt-3 rounded-lg border border-accent/40 bg-accent/10 p-2.5 text-[11px] font-mono text-accent">
                <div className="font-bold">GPS DEBUG</div>
                <div>Status: REQUESTING</div>
              </div>
            )}

            {gpsStatus === "success" && currentGpsLocation && (
              <div className="mt-3 rounded-lg border border-accent/40 bg-accent/10 p-2.5 text-[11px] font-mono text-accent">
                <div className="font-bold">GPS DEBUG</div>
                <div>Latitude: {currentGpsLocation.latitude.toFixed(5)}</div>
                <div>Longitude: {currentGpsLocation.longitude.toFixed(5)}</div>
                <div>Accuracy: ±{Math.round(currentGpsLocation.accuracy)} m</div>
                <div>Timestamp: {new Date(currentGpsLocation.timestamp).toLocaleTimeString()}</div>
                <div className="font-bold text-emerald-600 dark:text-emerald-400">Status: SUCCESS</div>
              </div>
            )}

            {gpsStatus === "timeout" && (
              <div className="mt-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-2.5 text-[11px] font-mono text-amber-700 dark:text-amber-300">
                <div className="font-bold">GPS DEBUG</div>
                <div>Status: TIMEOUT</div>
              </div>
            )}

            {locError && (
              <div className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300 font-medium whitespace-pre-line">
                ⚠️ {locError}
              </div>
            )}

            <div className="my-4 flex items-center gap-3">
              <div className="h-px flex-1 bg-line" />
              <span className="text-[11px] uppercase tracking-wider text-muted">or enter city</span>
              <div className="h-px flex-1 bg-line" />
            </div>

            <form onSubmit={handleManualCitySubmit} className="flex gap-2">
              <input
                type="text"
                className="input !py-2 text-xs sm:text-sm"
                placeholder="Enter city (e.g. Bengaluru, Mumbai, Goa, Paris, Tokyo)"
                value={manualCity}
                onChange={(e) => setManualCity(e.target.value)}
                autoFocus
              />
              <button type="submit" className="btn-secondary shrink-0 !py-2 text-xs font-semibold">
                Set
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
