import { NextRequest, NextResponse } from "next/server";
import { listHotels } from "@/lib/data";
import { searchPlaces, type GeoPlace } from "@/lib/geocoding";

export const dynamic = "force-dynamic";

/**
 * GET /api/geo/search?q=..
 * Worldwide autocomplete for cities, regions, countries, destinations and
 * addresses. If the upstream geocoder is unreachable we degrade gracefully
 * to the seeded hotel cities (with their real coordinates) so the demo
 * keeps working offline.
 */
export async function GET(request: NextRequest) {
  const q = (request.nextUrl.searchParams.get("q") ?? "").trim();
  if (q.length < 2) {
    return NextResponse.json({ places: [], source: "none" });
  }

  try {
    const places = await searchPlaces(q);
    if (places.length > 0) {
      return NextResponse.json({ places, source: "worldwide" });
    }
  } catch {
    // fall through to local fallback
  }

  // graceful degradation: one entry per seeded city that matches
  const lower = q.toLowerCase();
  const byCity = new Map<string, GeoPlace>();
  for (const h of await listHotels()) {
    if (!h.city.toLowerCase().includes(lower) || byCity.has(h.city)) continue;
    byCity.set(h.city, {
      id: `local-${h.city}`,
      label: [h.city, h.country].filter(Boolean).join(", "),
      name: h.city,
      region: undefined,
      country: h.country,
      latitude: h.latitude,
      longitude: h.longitude,
      kind: "hotel-city",
    });
  }

  return NextResponse.json({ places: [...byCity.values()].slice(0, 6), source: "fallback" });
}
