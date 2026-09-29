import { NextRequest, NextResponse } from "next/server";
import { getNearbyPOIs, POICategory } from "@/lib/location/location-service";
import { searchDataset } from "@/lib/hotels/hotel-service";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const latStr = searchParams.get("lat");
  const lngStr = searchParams.get("lng");
  const category = searchParams.get("category") as POICategory | null;
  const limit = Math.min(50, Math.max(1, Number(searchParams.get("limit") ?? 20)));

  const hasCoords = Boolean(latStr && lngStr);
  const latitude = latStr ? Number.parseFloat(latStr) : undefined;
  const longitude = lngStr ? Number.parseFloat(lngStr) : undefined;

  if (hasCoords && (!Number.isFinite(latitude) || !Number.isFinite(longitude))) {
    return NextResponse.json({ error: "Invalid coordinates." }, { status: 400 });
  }

  const userPoint = hasCoords && latitude !== undefined && longitude !== undefined
    ? { latitude, longitude }
    : null;

  // Fetch nearby dataset hotels
  let datasetHotels: Array<{
    id: string;
    slug: string;
    name: string;
    city: string;
    distanceKm: number;
    price_per_night_inr: number;
    rooms_available: number;
    latitude: number;
    longitude: number;
  }> = [];

  const radiusParam = searchParams.get("radius");
  const parsedRadius = radiusParam ? Number.parseFloat(radiusParam) : undefined;
  const explicitRadius = Number.isFinite(parsedRadius) ? parsedRadius : undefined;

  try {
    let hotels = await searchDataset({
      latitude,
      longitude,
      radiusKm: explicitRadius ?? 100,
    });
    if (hotels.length === 0 && !explicitRadius) {
      hotels = await searchDataset({
        latitude,
        longitude,
      });
    }
    datasetHotels = hotels.map((h) => ({
      id: h.hotel_id,
      slug: h.hotel_id,
      name: h.name,
      city: h.city,
      distanceKm: h.distanceKm ?? 0,
      price_per_night_inr: h.price_per_night_inr,
      rooms_available: h.rooms_available,
      latitude: h.latitude,
      longitude: h.longitude,
    }));
  } catch {
    // Gracefully continue with generated POIs
  }

  // Get generic POIs if location is known
  const pois = userPoint ? getNearbyPOIs(userPoint) : [];

  // Convert dataset hotels into POI format
  const hotelPOIs = datasetHotels.map((h) => ({
    id: `hotel-${h.id}`,
    name: h.name,
    category: "hotels" as POICategory,
    categoryLabel: "Luxury Hotel",
    description: `5-star bespoke stay in ${h.city}. Featuring real-time photorealistic 3D room preview and curated guest amenities.`,
    latitude: h.latitude,
    longitude: h.longitude,
    rating: 4.9,
    priceLevel: `₹${h.price_per_night_inr.toLocaleString("en-IN")}/night`,
    distanceKm: h.distanceKm ?? 0,
    formattedDistance: h.distanceKm != null ? `${h.distanceKm.toFixed(1)} km` : "Curated",
    travelTimeText: h.distanceKm != null ? `${Math.max(2, Math.round((h.distanceKm / 35) * 60))} min drive` : "Premier Stay",
    drivingTimeMinutes: h.distanceKm != null ? Math.max(2, Math.round((h.distanceKm / 35) * 60)) : 15,
    walkingTimeMinutes: h.distanceKm != null ? Math.round(h.distanceKm * 12.5) : 30,
    hotelSlug: h.slug,
    pricePerNightInr: h.price_per_night_inr,
    available: h.rooms_available > 0,
  }));

  const combined = [...hotelPOIs, ...pois];

  const filtered = category
    ? combined.filter((p) => p.category === category)
    : combined;

  const sorted = filtered.sort((a, b) => a.distanceKm - b.distanceKm).slice(0, limit);

  return NextResponse.json({
    origin: userPoint,
    count: sorted.length,
    items: sorted,
  });
}
