import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const tz = request.nextUrl.searchParams.get("tz") ?? "";

  // Extract client IP
  const forwardedFor = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");
  const cfIp = request.headers.get("cf-connecting-ip");
  const clientIp = (forwardedFor ? forwardedFor.split(",")[0].trim() : realIp || cfIp || "").trim();

  const isLocal =
    !clientIp ||
    clientIp === "127.0.0.1" ||
    clientIp === "::1" ||
    clientIp.startsWith("10.") ||
    clientIp.startsWith("192.168.") ||
    clientIp.startsWith("172.");

  if (!isLocal && clientIp) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);
      const res = await fetch(
        `http://ip-api.com/json/${clientIp}?fields=status,country,regionName,city,lat,lon`,
        { signal: controller.signal }
      );
      clearTimeout(timeoutId);
      if (res.ok) {
        const data = await res.json();
        if (data.status === "success" && Number.isFinite(data.lat) && Number.isFinite(data.lon)) {
          return NextResponse.json({
            success: true,
            location: {
              latitude: data.lat,
              longitude: data.lon,
              city: data.city,
              state: data.regionName,
              country: data.country,
              source: "ip-geocoder",
            },
          });
        }
      }
    } catch {}
  }

  // Timezone-based heuristics for local development and private networks
  if (/Kolkata|Calcutta|India|IST/i.test(tz) || !tz) {
    return NextResponse.json({
      success: true,
      location: {
        latitude: 28.6139,
        longitude: 77.2090,
        city: "New Delhi",
        state: "Delhi",
        country: "India",
        source: "timezone-estimate",
      },
    });
  }

  if (/London|Europe\/London/i.test(tz)) {
    return NextResponse.json({
      success: true,
      location: {
        latitude: 51.5074,
        longitude: -0.1278,
        city: "London",
        country: "United Kingdom",
        source: "timezone-estimate",
      },
    });
  }

  if (/New_York|America\/New_York/i.test(tz)) {
    return NextResponse.json({
      success: true,
      location: {
        latitude: 40.7128,
        longitude: -74.0060,
        city: "New York",
        state: "NY",
        country: "United States",
        source: "timezone-estimate",
      },
    });
  }

  if (/Tokyo|Asia\/Tokyo/i.test(tz)) {
    return NextResponse.json({
      success: true,
      location: {
        latitude: 35.6762,
        longitude: 139.6503,
        city: "Tokyo",
        country: "Japan",
        source: "timezone-estimate",
      },
    });
  }

  return NextResponse.json({
    success: true,
    location: {
      latitude: 28.6139,
      longitude: 77.2090,
      city: "New Delhi",
      state: "Delhi",
      country: "India",
      source: "default-hub",
    },
  });
}
