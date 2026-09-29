import { NextRequest, NextResponse } from "next/server";
import { providerMode, getProvider } from "@/lib/hotel-provider";
import { DatasetUnavailableError } from "@/lib/hotels/csv-loader";
import { searchDataset } from "@/lib/hotels/hotel-service";

export const dynamic = "force-dynamic";

/**
 * GET /api/hotels — the Aurelia hotel search API.
 *
 * Filters (all optional, combinable):
 *   city | state | search      destination / name / address matching (case-insensitive)
 *   lat & lng & radius         geographic search
 *   checkIn & checkOut & rooms availability window + stock
 *   minRating (4 | 4.5)        rating floor
 *   maxPrice (INR/night)       price ceiling
 *   roomType                   exact room_type value from the dataset
 *   sort                       recommended | price_asc | price_desc | rating | reviews
 */
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const mode = providerMode();
  const provider = getProvider();

  if (!provider) {
    return NextResponse.json(
      {
        success: false,
        error: "LIVE_CONNECTION_REQUIRED",
        message: "Amadeus hotel provider is not configured.",
        requires: [
          { env: "HOTEL_PROVIDER", value: "amadeus" },
          { env: "HOTEL_API_KEY", value: "<from developers.amadeus.com>" },
          { env: "HOTEL_API_SECRET", value: "<from developers.amadeus.com>" },
        ],
      },
      { status: 503 }
    );
  }

  try {
    const lat = Number.isFinite(Number.parseFloat(sp.get("lat") ?? "")) ? Number.parseFloat(sp.get("lat")!) : undefined;
    const lng = Number.isFinite(Number.parseFloat(sp.get("lng") ?? "")) ? Number.parseFloat(sp.get("lng")!) : undefined;
    const hasCoords = lat !== undefined && lng !== undefined;
    const hotels = await searchDataset({
      city: hasCoords ? undefined : (sp.get("city") ?? undefined),
      state: hasCoords ? undefined : (sp.get("state") ?? undefined),
      search: hasCoords ? undefined : (sp.get("search") ?? undefined),
      latitude: lat,
      longitude: lng,
      radiusKm: Number.parseFloat(sp.get("radius") ?? "") || undefined,
      checkIn: sp.get("checkIn") ?? undefined,
      checkOut: sp.get("checkOut") ?? undefined,
      rooms: Number.parseInt(sp.get("rooms") ?? "1", 10) || 1,
      minRating: Number.parseFloat(sp.get("minRating") ?? "") || undefined,
      maxPrice: Number.parseFloat(sp.get("maxPrice") ?? "") || undefined,
      roomType: sp.get("roomType") ?? undefined,
      sort: sp.get("sort") ?? undefined,
    });
    return NextResponse.json({
      success: true,
      source: mode === "amadeus" ? "amadeus" : "csv",
      count: hotels.length,
      // origin echo (near-me contract): real coordinates back to the client
      ...(lat != null && lng != null ? { origin: { latitude: lat, longitude: lng } } : {}),
      hotels,
    });
  } catch (e) {
    if (e instanceof DatasetUnavailableError) {
      return NextResponse.json({ success: false, error: "DATASET_UNAVAILABLE", message: e.message }, { status: 503 });
    }
    return NextResponse.json({ success: false, error: "SEARCH_FAILED" }, { status: 500 });
  }
}
