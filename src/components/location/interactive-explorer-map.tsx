"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { GeoPoint, projectPoints, haversineKm } from "@/lib/geo";
import { POICategory, POIItem } from "@/lib/location/location-service";

export interface InteractiveMapProps {
  userPoint?: (GeoPoint & { accuracy?: number }) | null;
  items: POIItem[];
  title?: string;
  defaultCategory?: POICategory | "all";
  onLocateMe?: () => void;
}

const W = 800;
const H = 480;

const CATEGORY_COLORS: Record<string, string> = {
  hotels: "#a5763f",       // Luxury gold
  restaurants: "#d97706",  // Warm amber
  cafes: "#b45309",        // Coffee bronze
  airports: "#2563eb",     // Sky blue
  attractions: "#7c3aed",  // Royal purple
  shopping: "#db2777",     // Magenta boutique
  spas: "#059669",         // Emerald sanctuary
  transport: "#4b5563",    // Slate transit
  hospitals: "#dc2626",    // Coral emergency
};

const CATEGORY_ICONS: Record<string, string> = {
  hotels: "🏨",
  restaurants: "🍽️",
  cafes: "☕",
  airports: "✈️",
  attractions: "🏛️",
  shopping: "🛍️",
  spas: "🧖",
  transport: "🚆",
  hospitals: "🏥",
};

export function InteractiveExplorerMap({
  userPoint,
  items,
  title = "Explore Destination & Surroundings",
  defaultCategory = "all",
  onLocateMe,
}: InteractiveMapProps) {
  const [activeCategory, setActiveCategory] = useState<POICategory | "all">(defaultCategory);
  const [selectedItem, setSelectedItem] = useState<POIItem | null>(null);
  const [viewMode, setViewMode] = useState<"leaflet" | "vector">("leaflet");
  const [leafletReady, setLeafletReady] = useState(false);

  // Vector canvas pan & zoom state
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [scale, setScale] = useState<number>(1);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const currentPanRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Leaflet refs
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const leafletMapRef = useRef<any>(null);
  const userMarkerRef = useRef<any>(null);
  const userAccuracyCircleRef = useRef<any>(null);
  const poiLayerGroupRef = useRef<any>(null);

  const filteredItems = activeCategory === "all"
    ? items
    : items.filter((item) => item.category === activeCategory);

  const allPoints: GeoPoint[] = [
    ...(userPoint ? [userPoint] : []),
    ...filteredItems.map((item) => ({ latitude: item.latitude, longitude: item.longitude })),
  ];

  const projected = projectPoints(allPoints, W, H, 0.15);
  const userPin = userPoint && projected.length > 0 ? projected[0] : null;
  const itemPins = userPoint ? projected.slice(1) : projected;

  const categories: Array<{ id: POICategory | "all"; label: string; icon: string }> = [
    { id: "all", label: "All POIs", icon: "📍" },
    { id: "hotels", label: "Hotels", icon: "🏨" },
    { id: "restaurants", label: "Dining", icon: "🍽️" },
    { id: "cafes", label: "Cafés", icon: "☕" },
    { id: "airports", label: "Airports", icon: "✈️" },
    { id: "attractions", label: "Attractions", icon: "🏛️" },
    { id: "spas", label: "Spas", icon: "🧖" },
    { id: "shopping", label: "Shopping", icon: "🛍️" },
    { id: "transport", label: "Transport", icon: "🚆" },
  ];

  // Initialize Leaflet Map
  useEffect(() => {
    if (typeof window === "undefined" || !mapContainerRef.current) return;
    let isMounted = true;

    async function initLeaflet() {
      try {
        const L = (await import("leaflet")).default;
        if (!isMounted || !mapContainerRef.current) return;

        // If map already exists, just return
        if (leafletMapRef.current) return;

        const defaultLat = userPoint ? userPoint.latitude : (filteredItems[0]?.latitude ?? 20.5937);
        const defaultLng = userPoint ? userPoint.longitude : (filteredItems[0]?.longitude ?? 78.9629);
        const defaultZoom = userPoint ? 14 : 12;

        const map = L.map(mapContainerRef.current, {
          center: [defaultLat, defaultLng],
          zoom: defaultZoom,
          zoomControl: false,
        });

        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
          maxZoom: 19,
        }).addTo(map);

        const poiLayer = L.layerGroup().addTo(map);
        poiLayerGroupRef.current = poiLayer;
        leafletMapRef.current = map;
        setLeafletReady(true);
      } catch (err) {
        console.warn("Leaflet initialization fallback to vector view:", err);
        setViewMode("vector");
      }
    }

    initLeaflet();

    return () => {
      isMounted = false;
      if (leafletMapRef.current) {
        leafletMapRef.current.remove();
        leafletMapRef.current = null;
        setLeafletReady(false);
      }
    };
  }, []);

  // Update Leaflet user marker and accuracy ring dynamically
  useEffect(() => {
    if (!leafletMapRef.current || !leafletReady) return;

    async function updateUserLayer() {
      const L = (await import("leaflet")).default;
      const map = leafletMapRef.current;
      if (!map) return;

      if (userPoint) {
        const latLng = [userPoint.latitude, userPoint.longitude] as [number, number];
        const accuracyMeters = userPoint.accuracy && userPoint.accuracy > 0 ? userPoint.accuracy : 40;
        const accuracyLabel = userPoint.accuracy ? ` ±${Math.round(userPoint.accuracy)}m` : "";

        if (!userMarkerRef.current) {
          const userIcon = L.divIcon({
            className: "aurelia-user-marker-icon",
            html: `
              <div style="position:relative; display:flex; flex-direction:column; align-items:center;">
                <div style="width:20px; height:20px; border-radius:50%; background:#2563eb; border:3px solid #ffffff; box-shadow:0 0 10px rgba(37,99,235,0.7); display:flex; align-items:center; justify-content:center;">
                  <div style="width:6px; height:6px; border-radius:50%; background:#ffffff;"></div>
                </div>
                <div style="margin-top:2px; background:rgba(15,23,42,0.9); color:#ffffff; font-size:10px; font-weight:700; padding:2px 6px; border-radius:4px; white-space:nowrap; box-shadow:0 2px 5px rgba(0,0,0,0.35);">
                  🔵 You are here${accuracyLabel}
                </div>
              </div>
            `,
            iconSize: [100, 42],
            iconAnchor: [50, 10],
          });

          userMarkerRef.current = L.marker(latLng, { icon: userIcon, zIndexOffset: 1000 }).addTo(map);

          userAccuracyCircleRef.current = L.circle(latLng, {
            radius: accuracyMeters,
            color: "#2563eb",
            fillColor: "#3b82f6",
            fillOpacity: 0.15,
            weight: 1.5,
            dashArray: "4, 4",
          }).addTo(map);

          map.flyTo(latLng, 14, { duration: 1.2 });
        } else {
          userMarkerRef.current.setLatLng(latLng);
          userAccuracyCircleRef.current.setLatLng(latLng);
          userAccuracyCircleRef.current.setRadius(accuracyMeters);
          map.flyTo(latLng, 14, { duration: 1.2 });
        }
      } else {
        if (userMarkerRef.current) {
          userMarkerRef.current.remove();
          userMarkerRef.current = null;
        }
        if (userAccuracyCircleRef.current) {
          userAccuracyCircleRef.current.remove();
          userAccuracyCircleRef.current = null;
        }
      }
    }

    updateUserLayer();
  }, [userPoint, leafletReady]);

  // Update Leaflet POI markers
  useEffect(() => {
    if (!leafletMapRef.current || !poiLayerGroupRef.current || !leafletReady) return;

    async function updatePOIs() {
      const L = (await import("leaflet")).default;
      const layer = poiLayerGroupRef.current;
      layer.clearLayers();

      filteredItems.forEach((item) => {
        const color = CATEGORY_COLORS[item.category] || "#a5763f";
        const icon = CATEGORY_ICONS[item.category] || "📍";
        const isSelected = selectedItem?.id === item.id;

        const poiIcon = L.divIcon({
          className: `aurelia-poi-icon ${isSelected ? "selected" : ""}`,
          html: `
            <div style="cursor:pointer; display:flex; flex-direction:column; align-items:center; transition:transform 0.2s;">
              <div style="width:${isSelected ? "32px" : "26px"}; height:${isSelected ? "32px" : "26px"}; border-radius:50%; background:${color}; border:${isSelected ? "3px solid #d4af37" : "2px solid #ffffff"}; display:flex; align-items:center; justify-content:center; box-shadow:0 3px 8px rgba(0,0,0,0.35); font-size:${isSelected ? "14px" : "12px"};">
                ${icon}
              </div>
            </div>
          `,
          iconSize: [32, 32],
          iconAnchor: [16, 16],
        });

        const marker = L.marker([item.latitude, item.longitude], { icon: poiIcon });
        marker.on("click", () => {
          setSelectedItem(item);
        });
        layer.addLayer(marker);
      });
    }

    updatePOIs();
  }, [filteredItems, selectedItem, leafletReady]);

  // "📍 Locate Me" handler: flies/centers map back to user GPS
  const handleLocateMe = useCallback(() => {
    if (userPoint) {
      if (viewMode === "leaflet" && leafletMapRef.current) {
        leafletMapRef.current.flyTo([userPoint.latitude, userPoint.longitude], 15, {
          duration: 1.2,
        });
      } else {
        setPan({ x: 0, y: 0 });
        setScale(1);
      }
    }
    if (onLocateMe) {
      onLocateMe();
    }
  }, [userPoint, viewMode, onLocateMe]);

  // Zoom handlers
  const handleZoomIn = () => {
    if (viewMode === "leaflet" && leafletMapRef.current) {
      leafletMapRef.current.zoomIn();
    } else {
      setScale((s) => Math.min(3, s + 0.25));
    }
  };

  const handleZoomOut = () => {
    if (viewMode === "leaflet" && leafletMapRef.current) {
      leafletMapRef.current.zoomOut();
    } else {
      setScale((s) => Math.max(0.5, s - 0.25));
    }
  };

  // Vector canvas drag/pan handlers
  const handlePointerDown = (e: React.PointerEvent) => {
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    currentPanRef.current = { ...pan };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    setPan({
      x: currentPanRef.current.x + dx,
      y: currentPanRef.current.y + dy,
    });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (isDragging) {
      setIsDragging(false);
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {}
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.15 : -0.15;
    setScale((s) => Math.min(3, Math.max(0.5, s + delta)));
  };

  return (
    <div className="card overflow-hidden p-0 shadow-xl">
      {/* Map header & category chips */}
      <div className="border-b border-line bg-raised/80 px-4 py-3 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h3 className="font-display text-base font-semibold sm:text-lg">{title}</h3>
            {userPoint && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live GPS
              </span>
            )}
          </div>

          {/* View mode toggle */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setViewMode("leaflet")}
              className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
                viewMode === "leaflet"
                  ? "bg-accent text-on-accent shadow-sm"
                  : "border border-line bg-background text-muted hover:text-foreground"
              }`}
            >
              🗺️ OpenStreetMap
            </button>
            <button
              type="button"
              onClick={() => setViewMode("vector")}
              className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
                viewMode === "vector"
                  ? "bg-accent text-on-accent shadow-sm"
                  : "border border-line bg-background text-muted hover:text-foreground"
              }`}
            >
              ✨ Luxury Vector
            </button>
          </div>
        </div>

        {/* Scrollable category selector */}
        <div className="mt-3 flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {categories.map((c) => {
            const active = activeCategory === c.id;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  setActiveCategory(c.id);
                  setSelectedItem(null);
                }}
                aria-pressed={active}
                className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-all ${
                  active
                    ? "bg-accent text-on-accent shadow-sm"
                    : "border border-line bg-background hover:bg-raised text-foreground"
                }`}
              >
                <span>{c.icon}</span>
                <span>{c.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Map Display Container */}
      <div className="relative aspect-[16/10] w-full min-h-[420px] bg-[#f3ece0] overflow-hidden">
        {/* Floating Controls: Locate Me, Zoom In/Out, Reset */}
        <div className="absolute top-3 right-3 z-[500] flex flex-col gap-1.5 shadow-md">
          {(userPoint || onLocateMe) && (
            <button
              type="button"
              onClick={handleLocateMe}
              title="Center on My GPS Location"
              aria-label="Center on My GPS Location"
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-raised text-foreground shadow-sm hover:bg-background transition-all hover:scale-105 active:scale-95"
            >
              📍
            </button>
          )}
          <button
            type="button"
            onClick={handleZoomIn}
            title="Zoom In"
            aria-label="Zoom In"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-raised text-base font-bold text-foreground shadow-sm hover:bg-background transition-all hover:scale-105 active:scale-95"
          >
            +
          </button>
          <button
            type="button"
            onClick={handleZoomOut}
            title="Zoom Out"
            aria-label="Zoom Out"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-raised text-base font-bold text-foreground shadow-sm hover:bg-background transition-all hover:scale-105 active:scale-95"
          >
            −
          </button>
        </div>

        {/* 1. Leaflet OpenStreetMap View */}
        <div
          ref={mapContainerRef}
          className={`h-full w-full ${viewMode === "leaflet" ? "block" : "hidden"}`}
          style={{ minHeight: "420px" }}
        />

        {/* 2. Vector SVG View with Pan, Drag, Zoom */}
        {viewMode === "vector" && (
          <div
            className="h-full w-full cursor-grab active:cursor-grabbing select-none"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onWheel={handleWheel}
          >
            <svg
              viewBox={`0 0 ${W} ${H}`}
              className="h-full w-full"
              role="img"
              aria-label={`Interactive map of ${filteredItems.length} locations`}
            >
              <g
                transform={`translate(${pan.x}, ${pan.y}) scale(${scale})`}
                style={{ transformOrigin: "center center", transition: isDragging ? "none" : "transform 0.15s ease-out" }}
              >
                {/* Cartographic gridlines */}
                {Array.from({ length: 12 }, (_, i) => (
                  <line
                    key={`v${i}`}
                    x1={(W / 11) * i}
                    y1={0}
                    x2={(W / 11) * i}
                    y2={H}
                    stroke="#e2d7c3"
                    strokeWidth="0.8"
                  />
                ))}
                {Array.from({ length: 8 }, (_, i) => (
                  <line
                    key={`h${i}`}
                    x1={0}
                    y1={(H / 7) * i}
                    x2={W}
                    y2={(H / 7) * i}
                    stroke="#e2d7c3"
                    strokeWidth="0.8"
                  />
                ))}

                {/* User location pin with accuracy ring */}
                {userPin && (
                  <g transform={`translate(${userPin.x}, ${userPin.y})`}>
                    <circle r="22" fill="#2563eb" opacity="0.15" className="animate-ping" />
                    <circle r="14" fill="#2563eb" opacity="0.25" />
                    <circle r="7" fill="#2563eb" stroke="#ffffff" strokeWidth="2.5" />
                    <rect
                      x="-42"
                      y="-26"
                      width="84"
                      height="18"
                      rx="4"
                      fill="#0f172a"
                      opacity="0.9"
                    />
                    <text
                      y="-14"
                      textAnchor="middle"
                      fontSize="9"
                      fontWeight="bold"
                      fill="#ffffff"
                    >
                      🔵 You are here
                    </text>
                  </g>
                )}

                {/* POI pins */}
                {itemPins.map((pin, i) => {
                  const item = filteredItems[i];
                  if (!item) return null;
                  const isSelected = selectedItem?.id === item.id;
                  const color = CATEGORY_COLORS[item.category] || "#a5763f";
                  const icon = CATEGORY_ICONS[item.category] || "📍";

                  return (
                    <g
                      key={item.id}
                      transform={`translate(${pin.x}, ${pin.y})`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedItem(item);
                      }}
                      className="cursor-pointer transition-transform hover:scale-110"
                    >
                      {/* Hit area */}
                      <circle r="20" fill="transparent" />

                      {/* Outer pin ring */}
                      <circle
                        r={isSelected ? "15" : "11"}
                        fill={color}
                        stroke={isSelected ? "#d4af37" : "#ffffff"}
                        strokeWidth={isSelected ? "3" : "2"}
                        className="shadow-md transition-all"
                      />

                      {/* Emoji / icon inside */}
                      <text
                        y="3.5"
                        textAnchor="middle"
                        fontSize={isSelected ? "11" : "8"}
                        fill="#ffffff"
                      >
                        {icon}
                      </text>
                    </g>
                  );
                })}
              </g>
            </svg>
          </div>
        )}

        {/* Selected Location Card overlay */}
        {selectedItem && (
          <div className="animate-fade-up absolute bottom-3 left-3 right-3 max-w-sm rounded-2xl border border-line bg-raised/95 p-4 shadow-2xl backdrop-blur-md z-[600] sm:right-auto">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm">{CATEGORY_ICONS[selectedItem.category] || "📍"}</span>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-accent">
                    {selectedItem.categoryLabel}
                  </span>
                </div>
                <h4 className="font-display mt-0.5 truncate text-base font-semibold text-foreground">
                  {selectedItem.name}
                </h4>
                <p className="mt-1 line-clamp-2 text-xs leading-relaxed" style={{ color: "var(--muted)" }}>
                  {selectedItem.description}
                </p>

                {/* Real Distance and Travel Times */}
                <div className="mt-2.5 flex flex-wrap items-center gap-2 text-xs font-medium">
                  <span className="rounded-md bg-black/10 px-2 py-0.5 text-foreground">
                    📍 {selectedItem.formattedDistance}
                  </span>
                  <span className="rounded-md bg-black/10 px-2 py-0.5 text-foreground">
                    🚗 {selectedItem.drivingTimeMinutes}m drive
                  </span>
                  {selectedItem.walkingTimeMinutes < 45 && (
                    <span className="rounded-md bg-black/10 px-2 py-0.5 text-foreground">
                      🚶 {selectedItem.walkingTimeMinutes}m walk
                    </span>
                  )}
                </div>

                {/* Action buttons */}
                <div className="mt-3.5 flex items-center gap-2">
                  {selectedItem.category === "hotels" && (selectedItem.hotelSlug || selectedItem.id.startsWith("hotel-")) && (
                    <Link
                      href={`/hotels/${selectedItem.hotelSlug || selectedItem.id.replace("hotel-", "")}`}
                      className="btn-primary !py-1.5 !px-3 text-xs font-semibold"
                    >
                      Explore 3D Room ✨
                    </Link>
                  )}
                  {selectedItem.category === "airports" && (
                    <a
                      href="#airport-transfer"
                      className="btn-primary !py-1.5 !px-3 text-xs font-semibold"
                    >
                      Book VIP Transfer 🚗
                    </a>
                  )}
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                      selectedItem.name + " " + selectedItem.latitude + "," + selectedItem.longitude
                    )}`}
                    target="_blank"
                    rel="noreferrer"
                    className="btn-secondary !py-1.5 !px-2.5 text-xs font-semibold"
                  >
                    Directions ↗
                  </a>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedItem(null)}
                aria-label="Close details"
                className="rounded-full p-1 text-muted hover:bg-background hover:text-foreground"
              >
                ✕
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
