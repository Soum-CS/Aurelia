"use client";

import Link from "next/link";
import { GeoPoint, formatDistance, projectPoints } from "@/lib/geo";

export interface MapHotel {
  slug: string;
  name: string;
  latitude: number;
  longitude: number;
  distanceKm?: number;
}

const W = 640;
const H = 400;

export function StayMap({
  hotels,
  user,
  radiusKm,
}: {
  hotels: MapHotel[];
  user?: GeoPoint | null;
  radiusKm?: number | null;
}) {
  const points = [
    ...hotels.map((h) => ({ latitude: h.latitude, longitude: h.longitude })),
    ...(user ? [user] : []),
  ];
  const projected = projectPoints(points, W, H);

  const hotelPins = projected.slice(0, hotels.length).map((p, i) => ({
    ...p,
    hotel: hotels[i],
  }));
  const userPin = user ? projected[projected.length - 1] : null;

  // scale helpers for the distance ring
  const allLngs = points.map((p) => p.longitude);
  const allLats = points.map((p) => p.latitude);
  const minLng = Math.min(...allLngs) - 0.02;
  const maxLng = Math.max(...allLngs) + 0.02;
  const minLat = Math.min(...allLats) - 0.02;
  const maxLat = Math.max(...allLats) + 0.02;
  const sx = (lng: number) => ((lng - minLng) / (maxLng - minLng)) * W;
  const sy = (lat: number) => H - ((lat - minLat) / (maxLat - minLat)) * H;

  return (
    <div className="card overflow-hidden p-0">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full"
        role="img"
        aria-label={`Map of ${hotels.length} stays${user ? " with your location" : ""}`}
      >
        <rect width={W} height={H} fill="#ece4d3" />
        {/* subtle grid */}
        {Array.from({ length: 9 }, (_, i) => (
          <line key={`v${i}`} x1={(W / 8) * i} y1={0} x2={(W / 8) * i} y2={H} stroke="#e0d5bf" strokeWidth="1" />
        ))}
        {Array.from({ length: 6 }, (_, i) => (
          <line key={`h${i}`} x1={0} y1={(H / 5) * i} x2={W} y2={(H / 5) * i} stroke="#e0d5bf" strokeWidth="1" />
        ))}

        {user && radiusKm && (
          <>
            {[radiusKm, radiusKm / 2].map((r) => {
              const dLat = r / 111;
              const dLng = r / (111 * Math.cos((user.latitude * Math.PI) / 180));
              return (
                <ellipse
                  key={r}
                  cx={sx(user.longitude)}
                  cy={sy(user.latitude)}
                  rx={Math.abs(sx(user.longitude + dLng) - sx(user.longitude))}
                  ry={Math.abs(sy(user.latitude + dLat) - sy(user.latitude))}
                  fill="none"
                  stroke="var(--accent)"
                  strokeDasharray="4 5"
                  strokeWidth="1.4"
                  opacity="0.55"
                />
              );
            })}
          </>
        )}

        {hotelPins.map((pin) => (
          <g key={pin.hotel.slug} className="cursor-pointer">
            <Link href={`/hotels/${pin.hotel.slug}`} aria-label={`${pin.hotel.name}${pin.hotel.distanceKm !== undefined ? ` — ${formatDistance(pin.hotel.distanceKm)} away` : ""}`}>
              {/* larger hit area */}
              <circle cx={pin.x} cy={pin.y} r="26" fill="transparent" />
              <circle
                cx={pin.x}
                cy={pin.y}
                r="9"
                fill="var(--accent)"
                stroke="#fffdf8"
                strokeWidth="2.5"
              />
              <text
                x={pin.x + 15}
                y={pin.y - 10}
                fontSize="13"
                fontWeight="600"
                fill="var(--ink)"
                style={{ fontFamily: "inherit" }}
              >
                {pin.hotel.name}
              </text>
              {pin.hotel.distanceKm !== undefined && (
                <text
                  x={pin.x + 15}
                  y={pin.y + 6}
                  fontSize="11"
                  fill="var(--accent-strong, #7d582c)"
                  style={{ fontFamily: "inherit" }}
                >
                  {formatDistance(pin.hotel.distanceKm)}
                </text>
              )}
            </Link>
          </g>
        ))}

        {userPin && (
          <g>
            <circle cx={userPin.x} cy={userPin.y} r="14" fill="var(--pine)" opacity="0.18">
              <animate attributeName="r" values="10;18;10" dur="2.4s" repeatCount="indefinite" />
            </circle>
            <circle cx={userPin.x} cy={userPin.y} r="7" fill="var(--pine)" stroke="#fffdf8" strokeWidth="2.5" />
            <text x={userPin.x + 13} y={userPin.y - 12} fontSize="12" fontWeight="700" fill="var(--pine)" style={{ fontFamily: "inherit" }}>
              You are here
            </text>
          </g>
        )}
      </svg>
    </div>
  );
}
