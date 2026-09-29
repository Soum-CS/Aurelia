import { NextRequest, NextResponse } from "next/server";
import { reverseGeocode } from "@/lib/geocoding";

export const dynamic = "force-dynamic";

/**
 * GET /api/geo/reverse?lat=..&lng=..
 * Coordinates → "City, Region, Country" (used after browser geolocation).
 */
export async function GET(request: NextRequest) {
  const lat = Number.parseFloat(request.nextUrl.searchParams.get("lat") ?? "");
  const lng = Number.parseFloat(request.nextUrl.searchParams.get("lng") ?? "");
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ error: "lat and lng are required numbers" }, { status: 400 });
  }

  try {
    const place = await reverseGeocode(lat, lng);
    return NextResponse.json({ place });
  } catch {
    return NextResponse.json(
      {
        place: null,
        notice: "Could not look up the place name — using your coordinates instead.",
      },
      { status: 200 }
    );
  }
}
