import { NextRequest, NextResponse } from "next/server";
import { fetchLiveWeather } from "@/lib/location/weather-service";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const latStr = searchParams.get("lat");
  const lngStr = searchParams.get("lng");

  if (!latStr || !lngStr) {
    return NextResponse.json({ error: "lat and lng parameters are required." }, { status: 400 });
  }

  const latitude = Number.parseFloat(latStr);
  const longitude = Number.parseFloat(lngStr);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return NextResponse.json({ error: "Invalid coordinates." }, { status: 400 });
  }

  try {
    const weather = await fetchLiveWeather({ latitude, longitude });
    return NextResponse.json(weather);
  } catch {
    return NextResponse.json({ error: "Could not fetch weather data." }, { status: 500 });
  }
}
