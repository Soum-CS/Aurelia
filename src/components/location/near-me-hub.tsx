"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { POICategory, POIItem } from "@/lib/location/location-service";
import { InteractiveExplorerMap } from "./interactive-explorer-map";
import { registerGpsWatch, unregisterGpsWatch } from "@/lib/location/gps-watcher";

export type GpsStatus =
  | "idle"
  | "requesting"
  | "success"
  | "permission-denied"
  | "position-unavailable"
  | "timeout"
  | "error";

export interface LiveGpsLocation {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
}

export function NearMeHub() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [items, setItems] = useState<POIItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeCat, setActiveCat] = useState<POICategory | "all">("all");
  const [error, setError] = useState<string | null>(null);
  const [locError, setLocError] = useState<string | null>(null);
  const [gpsStatus, setGpsStatus] = useState<GpsStatus>("idle");
  const [isWatching, setIsWatching] = useState(false);
  const watchIdRef = useRef<number | null>(null);
  const [gpsPlaceLabel, setGpsPlaceLabel] = useState<string | null>(null);
  const [destinationPlace, setDestinationPlace] = useState<{ label: string; latitude: number; longitude: number } | null>(null);
  const [manualModalOpen, setManualModalOpen] = useState(false);
  const [manualQuery, setManualQuery] = useState("");
  const [manualSearching, setManualSearching] = useState(false);
  const [manualResults, setManualResults] = useState<Array<{ label: string; latitude: number; longitude: number }>>([]);

  // Live GPS state is strictly initialized as null per user requirements.
  // Never initialized with default coordinates or stored fake values.
  const [currentGpsLocation, setCurrentGpsLocation] = useState<LiveGpsLocation | null>(null);

  const rawLat = searchParams.get("lat");
  const rawLng = searchParams.get("lng");
  const parsedLat = rawLat ? Number.parseFloat(rawLat) : undefined;
  const parsedLng = rawLng ? Number.parseFloat(rawLng) : undefined;
  const hasParamCoords = Number.isFinite(parsedLat) && Number.isFinite(parsedLng);

  // Map userPoint: ONLY non-null when actual browser GPS has succeeded.
  const userPoint =
    gpsStatus === "success" && currentGpsLocation
      ? {
          latitude: currentGpsLocation.latitude,
          longitude: currentGpsLocation.longitude,
          accuracy: currentGpsLocation.accuracy,
        }
      : null;

  // Effective coordinates for nearby exploration (POIs & hotels):
  // Prioritizes live GPS if acquired; otherwise allows browsing destination coordinates if specified in URL/state
  const effectiveLat = currentGpsLocation?.latitude ?? destinationPlace?.latitude ?? (hasParamCoords ? parsedLat : undefined);
  const effectiveLng = currentGpsLocation?.longitude ?? destinationPlace?.longitude ?? (hasParamCoords ? parsedLng : undefined);

  // Reverse geocode detected GPS coordinates only after GPS success
  useEffect(() => {
    if (gpsStatus !== "success" || !currentGpsLocation) {
      setGpsPlaceLabel(null);
      return;
    }

    let isMounted = true;
    fetch(`/api/geo/reverse?lat=${currentGpsLocation.latitude}&lng=${currentGpsLocation.longitude}`)
      .then((res) => res.json())
      .then((data) => {
        if (!isMounted) return;
        if (data.place?.label) {
          setGpsPlaceLabel(data.place.label);
        } else {
          setGpsPlaceLabel(
            `${currentGpsLocation.latitude.toFixed(4)}, ${currentGpsLocation.longitude.toFixed(4)}`
          );
        }
      })
      .catch(() => {
        if (!isMounted) return;
        setGpsPlaceLabel(
          `${currentGpsLocation.latitude.toFixed(4)}, ${currentGpsLocation.longitude.toFixed(4)}`
        );
      });

    return () => {
      isMounted = false;
    };
  }, [gpsStatus, currentGpsLocation]);

  function applyLocation(latitude: number, longitude: number, accuracy: number, timestamp: number) {
    const gps: LiveGpsLocation = { latitude, longitude, accuracy, timestamp };
    setCurrentGpsLocation(gps);
    setGpsStatus("success");
    setLocError(null);

    // Print required debug logs
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

    // DIRECTLY reverse-geocode fresh coordinates
    fetch(`/api/geo/reverse?lat=${latitude}&lng=${longitude}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.place?.label) {
          setGpsPlaceLabel(data.place.label);
        } else {
          setGpsPlaceLabel(`${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
        }
      })
      .catch(() => {
        setGpsPlaceLabel(`${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
      });

    // DIRECTLY fetch nearby items with the fresh coordinates
    const qs = new URLSearchParams({ limit: "30", lat: String(latitude), lng: String(longitude) });
    if (activeCat !== "all") qs.set("category", activeCat);
    fetch(`/api/location/near-me?${qs.toString()}`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data.items)) {
          setItems(data.items);
          setLoading(false);
        }
      })
      .catch(() => {});

    // DIRECTLY trigger /api/hotels query with fresh GPS coordinates
    fetch(`/api/hotels?lat=${latitude}&lng=${longitude}`).catch(() => {});

    const params = new URLSearchParams(searchParams.toString());
    params.set("lat", String(latitude));
    params.set("lng", String(longitude));
    params.delete("radius");
    params.delete("q");
    params.delete("place");
    params.delete("city");
    params.delete("state");
    params.delete("search");
    router.push(`/?${params.toString()}#near-me-hub`, { scroll: false });
  }

  // Request device GPS location with high accuracy, timeout: 20000, maximumAge: 0
  function requestDeviceLocation() {
    if (typeof window === "undefined" || !("geolocation" in navigator)) {
      setGpsStatus("error");
      setLocError("Geolocation is not supported by your browser.");
      return;
    }

    // Clear previous GPS result immediately
    setCurrentGpsLocation(null);
    setGpsPlaceLabel(null);
    setGpsStatus("requesting");
    setLocError(null);

    const gpsOptions: PositionOptions = {
      enableHighAccuracy: true,
      timeout: 20000,
      maximumAge: 0,
    };

    function attemptPosition(isRetry = false) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude, accuracy } = pos.coords;
          const timestamp = pos.timestamp;
          applyLocation(latitude, longitude, accuracy, timestamp);
        },
        (err) => {
          // If GPS times out: retry GPS once using high accuracy
          if ((err.code === 3 || err.code === err.TIMEOUT) && !isRetry) {
            console.log("GPS detection timed out. Retrying once with high accuracy...");
            attemptPosition(true);
            return;
          }

          console.warn("GPS error (code " + err.code + "):", err.message);
          setCurrentGpsLocation(null);
          setGpsPlaceLabel(null);
          let errorMsg = "An unexpected error occurred while detecting your location. Please try again.";
          let status: GpsStatus = "error";

          if (err.code === 1 || err.code === err.PERMISSION_DENIED) {
            status = "permission-denied";
            errorMsg = "Location permission was denied.\nPlease enable location access for Aurelia in your browser/device settings.";
          } else if (err.code === 2 || err.code === err.POSITION_UNAVAILABLE) {
            status = "position-unavailable";
            errorMsg = "Your current location could not be determined.\nPlease check your device location/GPS settings and try again.";
          } else if (err.code === 3 || err.code === err.TIMEOUT) {
            status = "timeout";
            errorMsg = "Location detection timed out.\nPlease try again in an area with better GPS access.";
          }

          setGpsStatus(status);
          setLocError(errorMsg);
        },
        gpsOptions
      );
    }

    attemptPosition(false);
  }

  // Live GPS tracking using watchPosition without page reload
  function toggleLiveTracking() {
    if (isWatching) {
      if (watchIdRef.current !== null) {
        unregisterGpsWatch(watchIdRef.current);
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      setIsWatching(false);
      return;
    }

    if (!("geolocation" in navigator)) {
      setGpsStatus("error");
      setLocError("Geolocation is not supported by your browser.");
      return;
    }

    setLocError(null);
    setIsWatching(true);
    setGpsStatus("requesting");

    const wid = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        const timestamp = pos.timestamp;
        applyLocation(latitude, longitude, accuracy, timestamp);
      },
      (err) => {
        console.warn("Live GPS watch error:", err.message);
        setIsWatching(false);
        if (watchIdRef.current !== null) {
          unregisterGpsWatch(watchIdRef.current);
          navigator.geolocation.clearWatch(watchIdRef.current);
          watchIdRef.current = null;
        }
        setCurrentGpsLocation(null);
        setGpsPlaceLabel(null);
        let errorMsg = "An unexpected error occurred while detecting your location. Please try again.";
        let status: GpsStatus = "error";

        if (err.code === 1 || err.code === err.PERMISSION_DENIED) {
          status = "permission-denied";
          errorMsg = "Location permission was denied.\nPlease enable location access for Aurelia in your browser/device settings.";
        } else if (err.code === 2 || err.code === err.POSITION_UNAVAILABLE) {
          status = "position-unavailable";
          errorMsg = "Your current location could not be determined.\nPlease check your device location/GPS settings and try again.";
        } else if (err.code === 3 || err.code === err.TIMEOUT) {
          status = "timeout";
          errorMsg = "Location detection timed out.\nPlease try again in an area with better GPS access.";
        }

        setGpsStatus(status);
        setLocError(errorMsg);
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
    );

    registerGpsWatch(wid);
    watchIdRef.current = wid;
  }

  // Cleanup watchPosition on unmount and stop tracking on logout
  useEffect(() => {
    function handleLogout() {
      if (watchIdRef.current !== null) {
        unregisterGpsWatch(watchIdRef.current);
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      setIsWatching(false);
      setCurrentGpsLocation(null);
      setGpsPlaceLabel(null);
      setGpsStatus("idle");
    }

    window.addEventListener("aurelia:logout", handleLogout);
    return () => {
      window.removeEventListener("aurelia:logout", handleLogout);
      if (watchIdRef.current !== null) {
        unregisterGpsWatch(watchIdRef.current);
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  // Fetch nearby POIs and hotels based on coordinates
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const qs = new URLSearchParams({ limit: "30" });
    if (effectiveLat !== undefined && effectiveLng !== undefined) {
      qs.set("lat", String(effectiveLat));
      qs.set("lng", String(effectiveLng));
    }
    if (activeCat !== "all") qs.set("category", activeCat);

    fetch(`/api/location/near-me?${qs.toString()}`)
      .then((res) => {
        if (!res.ok) throw new Error("Could not load nearby locations.");
        return res.json();
      })
      .then((data) => {
        if (!cancelled && Array.isArray(data.items)) {
          setItems(data.items);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [effectiveLat, effectiveLng, activeCat]);

  // Handle manual city search
  async function handleManualSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!manualQuery.trim()) return;
    setManualSearching(true);
    try {
      const res = await fetch(`/api/geo/search?q=${encodeURIComponent(manualQuery.trim())}`);
      const data = await res.json();
      if (Array.isArray(data.places)) {
        setManualResults(data.places);
      }
    } catch {
      setManualResults([]);
    } finally {
      setManualSearching(false);
    }
  }

  function selectManualPlace(place: { label: string; latitude: number; longitude: number }) {
    setManualModalOpen(false);
    setLocError(null);
    setDestinationPlace(place);

    const params = new URLSearchParams(searchParams.toString());
    params.set("lat", String(place.latitude));
    params.set("lng", String(place.longitude));
    params.set("place", place.label);
    params.delete("radius");
    params.delete("q");
    router.push(`/?${params.toString()}#near-me-hub`, { scroll: false });
  }

  const categories: Array<{ id: POICategory | "all"; label: string; icon: string }> = [
    { id: "all", label: "All Surroundings", icon: "📍" },
    { id: "hotels", label: "Hotels", icon: "🏨" },
    { id: "restaurants", label: "Fine Dining", icon: "🍽️" },
    { id: "cafes", label: "Cafés", icon: "☕" },
    { id: "airports", label: "Airports", icon: "✈️" },
    { id: "attractions", label: "Attractions", icon: "🏛️" },
    { id: "spas", label: "Spas", icon: "🧖" },
    { id: "shopping", label: "Shopping", icon: "🛍️" },
    { id: "transport", label: "Transport", icon: "🚆" },
    { id: "hospitals", label: "Medical", icon: "🏥" },
  ];

  return (
    <section id="near-me-hub" className="mt-14 sm:mt-20">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow">Location Intelligence</p>
          <h2 className="font-display mt-1 text-2xl font-semibold sm:text-3xl">
            Aurelia Near You
          </h2>
          <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
            Explore verified 5-star properties, fine dining, executive airport transfers, and cultural highlights.
          </p>

          {/* Mutually exclusive GPS status rendering */}
          {gpsStatus === "requesting" ? (
            <div className="mt-2 flex flex-col gap-1.5">
              <div className="flex items-center gap-2 text-xs font-semibold text-accent">
                <span className="inline-flex h-2 w-2 rounded-full bg-accent animate-ping" />
                <span>📍 Detecting your current location...</span>
              </div>
              <div className="mt-0.5 inline-flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-accent/40 bg-accent/10 px-2.5 py-1 text-[11px] font-mono text-accent">
                <span className="font-bold">GPS DEBUG</span>
                <span>Status: REQUESTING</span>
              </div>
            </div>
          ) : gpsStatus === "success" && currentGpsLocation ? (
            <div className="mt-2 flex flex-col gap-1.5">
              <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-foreground">
                <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>📍 Your current location:</span>
                <span className="text-accent underline underline-offset-2">
                  {gpsPlaceLabel || `${currentGpsLocation.latitude.toFixed(4)}, ${currentGpsLocation.longitude.toFixed(4)}`}
                </span>
                <span className="rounded bg-black/10 dark:bg-white/10 px-2 py-0.5 text-[11px] font-normal text-muted">
                  ±{Math.round(currentGpsLocation.accuracy)} m accuracy
                </span>
              </div>
              {/* GPS DEBUG diagnostic box with REAL GPS data only */}
              <div className="mt-0.5 inline-flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-accent/40 bg-accent/10 px-2.5 py-1 text-[11px] font-mono text-accent">
                <span className="font-bold">GPS DEBUG</span>
                <span>Latitude: {currentGpsLocation.latitude.toFixed(5)}</span>
                <span>Longitude: {currentGpsLocation.longitude.toFixed(5)}</span>
                <span>Accuracy: ±{Math.round(currentGpsLocation.accuracy)} m</span>
                <span>Timestamp: {new Date(currentGpsLocation.timestamp).toLocaleTimeString()}</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">Status: SUCCESS</span>
              </div>
            </div>
          ) : gpsStatus === "timeout" ? (
            <div className="mt-2 flex flex-col gap-1.5">
              <div className="mt-0.5 inline-flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 text-[11px] font-mono text-amber-700 dark:text-amber-300">
                <span className="font-bold">GPS DEBUG</span>
                <span>Status: TIMEOUT</span>
              </div>
              <div className="mt-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-2 text-amber-700 dark:text-amber-300 font-medium">
                    <span className="shrink-0 mt-0.5">⚠️</span>
                    <div className="whitespace-pre-line text-xs sm:text-sm">
                      Location detection timed out.
                      Please try again in an area with better GPS access.
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={requestDeviceLocation}
                    className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-amber-700 transition-colors shrink-0"
                  >
                    Try Again
                  </button>
                </div>
              </div>
            </div>
          ) : gpsStatus === "permission-denied" ? (
            <div className="mt-2 flex flex-col gap-1.5">
              <div className="mt-0.5 inline-flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 text-[11px] font-mono text-amber-700 dark:text-amber-300">
                <span className="font-bold">GPS DEBUG</span>
                <span>Status: PERMISSION_DENIED</span>
              </div>
              <div className="mt-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-2 text-amber-700 dark:text-amber-300 font-medium">
                    <span className="shrink-0 mt-0.5">⚠️</span>
                    <div className="whitespace-pre-line text-xs sm:text-sm">
                      Location permission was denied.
                      Please enable location access for Aurelia in your browser/device settings.
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={requestDeviceLocation}
                    className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-amber-700 transition-colors shrink-0"
                  >
                    Try Again
                  </button>
                </div>
              </div>
            </div>
          ) : gpsStatus === "position-unavailable" ? (
            <div className="mt-2 flex flex-col gap-1.5">
              <div className="mt-0.5 inline-flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 text-[11px] font-mono text-amber-700 dark:text-amber-300">
                <span className="font-bold">GPS DEBUG</span>
                <span>Status: POSITION_UNAVAILABLE</span>
              </div>
              <div className="mt-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-2 text-amber-700 dark:text-amber-300 font-medium">
                    <span className="shrink-0 mt-0.5">⚠️</span>
                    <div className="whitespace-pre-line text-xs sm:text-sm">
                      Your current location could not be determined.
                      Please check your device location/GPS settings and try again.
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={requestDeviceLocation}
                    className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-amber-700 transition-colors shrink-0"
                  >
                    Try Again
                  </button>
                </div>
              </div>
            </div>
          ) : (destinationPlace || (hasParamCoords && (searchParams.get("place") || searchParams.get("q")))) ? (
            <div className="mt-2 flex flex-col gap-1.5">
              <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-foreground">
                <span>📍 Exploring destination:</span>
                <span className="text-accent underline underline-offset-2">
                  {destinationPlace?.label || searchParams.get("place") || searchParams.get("q")}
                </span>
              </div>
              <div className="mt-0.5 inline-flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-line bg-surface px-2.5 py-1 text-[11px] font-mono text-muted">
                <span className="font-bold">GPS DEBUG</span>
                <span>Status: IDLE</span>
              </div>
            </div>
          ) : null}
        </div>

        {/* Action buttons: GPS, Live Track, Manual, Category selector */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Use My Current Location / Update My Location */}
          <button
            type="button"
            onClick={requestDeviceLocation}
            disabled={gpsStatus === "requesting"}
            className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all flex items-center gap-1.5 ${
              userPoint
                ? "border border-accent text-accent bg-raised hover:bg-background"
                : "bg-accent text-on-accent shadow-sm hover:opacity-90"
            }`}
          >
            <span>{userPoint ? "↻" : "📍"}</span>
            <span>
              {gpsStatus === "requesting"
                ? "Detecting your current location..."
                : userPoint
                ? "Update my location"
                : "Use my current location"}
            </span>
          </button>

          {/* Live GPS Watch toggle */}
          <button
            type="button"
            onClick={toggleLiveTracking}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-all flex items-center gap-1.5 ${
              isWatching
                ? "bg-emerald-600 text-white shadow-sm ring-2 ring-emerald-400"
                : "border border-line bg-raised hover:bg-background text-foreground"
            }`}
          >
            <span className={isWatching ? "animate-pulse" : ""}>📡</span>
            <span>{isWatching ? "Live Tracking Active" : "Track Live GPS"}</span>
          </button>

          {/* Enter Location Manually button */}
          <button
            type="button"
            onClick={() => setManualModalOpen(true)}
            className="rounded-full border border-line bg-raised hover:bg-background px-3 py-1.5 text-xs font-semibold text-foreground transition-all"
          >
            🔍 Search City
          </button>
        </div>
      </div>

      {/* Category filter pills */}
      <div className="mt-4 flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        {categories.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setActiveCat(c.id)}
            className={`flex shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold transition-all ${
              activeCat === c.id
                ? "bg-accent text-on-accent shadow-sm"
                : "border border-line bg-raised hover:bg-background text-foreground"
            }`}
          >
            <span>{c.icon}</span>
            <span>{c.label}</span>
          </button>
        ))}
      </div>

      {/* Interactive Map view with OpenStreetMap and Vector support */}
      <div className="mt-6">
        <InteractiveExplorerMap
          userPoint={userPoint}
          items={items}
          onLocateMe={requestDeviceLocation}
        />
      </div>

      {/* POI Cards Grid */}
      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skeleton h-44 rounded-2xl" />
          ))
        ) : error ? (
          <div className="col-span-full rounded-2xl border border-line bg-raised p-6 text-center text-sm text-muted">
            {error}
          </div>
        ) : items.length === 0 ? (
          <div className="col-span-full rounded-2xl border border-line bg-raised p-6 text-center text-sm text-muted">
            No locations found in this category.
          </div>
        ) : (
          items.map((item) => (
            <div
              key={item.id}
              className="card card-hover flex flex-col justify-between p-5 transition-all"
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-accent">
                    {item.categoryLabel}
                  </span>
                  {item.rating && (
                    <span className="flex items-center gap-1 text-xs font-semibold text-foreground">
                      ★ {item.rating}
                    </span>
                  )}
                </div>

                <h3 className="font-display mt-1.5 text-base font-semibold text-foreground">
                  {item.name}
                </h3>
                <p className="mt-1 line-clamp-2 text-xs leading-relaxed" style={{ color: "var(--muted)" }}>
                  {item.description}
                </p>
              </div>

              <div className="mt-4 border-t border-line pt-3">
                <div className="flex items-center justify-between text-xs font-medium">
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-black/10 px-1.5 py-0.5 text-foreground">
                      📍 {item.formattedDistance}
                    </span>
                    <span className="rounded bg-black/10 px-1.5 py-0.5 text-foreground">
                      🚗 {item.drivingTimeMinutes}m
                    </span>
                  </div>

                  {item.priceLevel && (
                    <span className="font-semibold text-accent">{item.priceLevel}</span>
                  )}
                </div>

                <div className="mt-3 flex items-center gap-2">
                  {item.category === "hotels" && (item.hotelSlug || item.id.startsWith("hotel-")) ? (
                    <Link
                      href={`/hotels/${item.hotelSlug || item.id.replace("hotel-", "")}`}
                      className="btn-primary w-full justify-center !py-1.5 text-xs font-semibold"
                    >
                      Explore 3D Room ✨
                    </Link>
                  ) : item.category === "airports" ? (
                    <a
                      href="#airport-transfer"
                      className="btn-primary w-full justify-center !py-1.5 text-xs font-semibold"
                    >
                      Book VIP Transfer 🚗
                    </a>
                  ) : (
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                        item.name + " " + item.latitude + "," + item.longitude
                      )}`}
                      target="_blank"
                      rel="noreferrer"
                      className="btn-secondary w-full justify-center !py-1.5 text-xs font-semibold"
                    >
                      Get Directions ↗
                    </a>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Manual Location Search Modal */}
      {manualModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="animate-fade-up w-full max-w-md rounded-3xl border border-line bg-raised p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg font-semibold">Enter Location Manually</h3>
              <button
                type="button"
                onClick={() => setManualModalOpen(false)}
                className="rounded-full p-1.5 text-muted hover:bg-background hover:text-foreground"
              >
                ✕
              </button>
            </div>

            <p className="mt-1 text-xs" style={{ color: "var(--muted)" }}>
              Search any global destination or city to explore hotels, 3D rooms, and local surroundings.
            </p>

            <form onSubmit={handleManualSearch} className="mt-4 flex gap-2">
              <input
                type="text"
                className="input !py-2 text-xs sm:text-sm"
                placeholder="Type city or place (e.g. Bhubaneswar, Mumbai, London)"
                value={manualQuery}
                onChange={(e) => setManualQuery(e.target.value)}
                autoFocus
              />
              <button
                type="submit"
                disabled={manualSearching}
                className="btn-primary shrink-0 !py-2 text-xs font-semibold"
              >
                {manualSearching ? "Searching…" : "Search"}
              </button>
            </form>

            {/* Search results list */}
            {manualResults.length > 0 && (
              <div className="mt-3 max-h-48 overflow-y-auto divide-y divide-line rounded-xl border border-line">
                {manualResults.map((r, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => selectManualPlace(r)}
                    className="w-full px-3 py-2 text-left text-xs text-foreground hover:bg-background transition-colors flex items-center gap-2"
                  >
                    <span>📍</span>
                    <span className="truncate">{r.label}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Curated quick city shortcuts */}
            <div className="mt-4">
              <span className="text-[11px] uppercase tracking-wider text-muted font-semibold">Popular Destinations:</span>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {[
                  { label: "Bengaluru, India", latitude: 12.9716, longitude: 77.5946 },
                  { label: "Mumbai, India", latitude: 19.0760, longitude: 72.8777 },
                  { label: "New Delhi, India", latitude: 28.6139, longitude: 77.2090 },
                  { label: "Bhubaneswar, India", latitude: 20.2961, longitude: 85.8245 },
                  { label: "Goa, India", latitude: 15.2993, longitude: 74.1240 },
                  { label: "Jaipur, India", latitude: 26.9124, longitude: 75.7873 },
                ].map((c) => (
                  <button
                    key={c.label}
                    type="button"
                    onClick={() => selectManualPlace(c)}
                    className="rounded-full border border-line bg-background px-2.5 py-1 text-[11px] font-medium text-foreground hover:bg-raised transition-colors"
                  >
                    {c.label.split(",")[0]}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
