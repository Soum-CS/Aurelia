import type { HotelProvider, ProviderHotel, ProviderRoomOffer, ProviderSearch } from "./types";

/**
 * Amadeus Hotel APIs adapter (Self-Service test or production host).
 *
 * Activates ONLY when HOTEL_PROVIDER=amadeus and HOTEL_API_KEY /
 * HOTEL_API_SECRET are present in the server environment — the browser
 * never sees these credentials; every call happens in Next.js server code.
 *
 * What you need to go live:
 *   1. A free Amadeus for Developers account → obtain API Key + Secret
 *      (self-service, test host). Production traffic requires Amadeus'
 *      paid tier / enterprise agreement.
 *   2. Set in .env.local:
 *        HOTEL_PROVIDER=amadeus
 *        HOTEL_API_KEY=...
 *        HOTEL_API_SECRET=...
 *        # optional override (defaults to the test host)
 *        HOTEL_API_BASE_URL=https://test.api.amadeus.com
 *
 * Endpoints used (official, documented):
 *   POST /v1/security/oauth2/token          (client-credentials)
 *   GET  /v1/reference-data/locations/hotels/by-geocode
 *   GET  /v3/shopping/hotel-offers
 */

const DEFAULT_BASE = "https://test.api.amadeus.com";

/** Typed failure so the UI can distinguish bad credentials from outages. */
export class AmadeusError extends Error {
  constructor(
    public kind: "auth" | "unavailable",
    message: string
  ) {
    super(message);
    this.name = "AmadeusError";
  }
}

interface TokenResponse {
  access_token: string;
  expires_in: number;
}

let token: { value: string; expiresAt: number } | null = null;

function config() {
  const apiKey = process.env.HOTEL_API_KEY;
  const apiSecret = process.env.HOTEL_API_SECRET;
  const base = process.env.HOTEL_API_BASE_URL || DEFAULT_BASE;
  return {
    base,
    apiKey,
    apiSecret,
    configured: Boolean(process.env.HOTEL_PROVIDER === "amadeus" && apiKey && apiSecret),
  };
}

export function amadeusConfigured(): boolean {
  return config().configured;
}

async function accessToken(): Promise<string> {
  const { base, apiKey, apiSecret } = config();
  if (!apiKey || !apiSecret) throw new Error("Amadeus credentials missing");
  if (token && Date.now() < token.expiresAt - 60_000) return token.value;

  const res = await fetch(`${base}/v1/security/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: apiKey,
      client_secret: apiSecret,
    }),
    signal: AbortSignal.timeout(8000),
    cache: "no-store",
  });
  if (!res.ok) {
    // 400/401 here means the key/secret pair was rejected — an auth problem,
    // not an outage. Never include credentials in the message.
    throw new AmadeusError("auth", `Amadeus rejected the credentials (${res.status})`);
  }
  const data = (await res.json()) as TokenResponse;
  token = { value: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return token.value;
}

async function amadeusGet<T>(path: string, params: Record<string, string>): Promise<T> {
  const { base } = config();
  let at: string;
  try {
    at = await accessToken();
  } catch (e) {
    if (e instanceof AmadeusError) throw e;
    throw new AmadeusError("unavailable", "Amadeus authentication endpoint unreachable");
  }
  let res: Response;
  try {
    res = await fetch(`${base}${path}?${new URLSearchParams(params)}`, {
      headers: { Authorization: `Bearer ${at}` },
      signal: AbortSignal.timeout(12000),
      cache: "no-store",
    });
  } catch {
    throw new AmadeusError("unavailable", "Amadeus API unreachable");
  }
  if (res.status === 401 || res.status === 403) {
    token = null; // stale/rejected token — force re-auth next attempt
    throw new AmadeusError("auth", "Amadeus access token rejected");
  }
  if (!res.ok) throw new AmadeusError("unavailable", `Amadeus ${path} ${res.status}`);
  return (await res.json()) as T;
}

/**
 * Health probe (§18): verifies configuration AND that authentication works.
 * Returns booleans only — never tokens or secrets.
 */
export async function amadeusHealth(): Promise<{
  provider: "amadeus";
  configured: boolean;
  authenticated: boolean;
  status: "ready" | "not-configured" | "auth-failed" | "unreachable";
}> {
  if (!amadeusConfigured()) {
    return { provider: "amadeus", configured: false, authenticated: false, status: "not-configured" };
  }
  try {
    await accessToken();
    return { provider: "amadeus", configured: true, authenticated: true, status: "ready" };
  } catch (e) {
    const kind = e instanceof AmadeusError ? e.kind : "unavailable";
    return {
      provider: "amadeus",
      configured: true,
      authenticated: false,
      status: kind === "auth" ? "auth-failed" : "unreachable",
    };
  }
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function mapHotel(h: any): ProviderHotel {
  const addr = h.address ?? {};
  return {
    id: `amadeus-${h.hotelId}`,
    slug: `amadeus-${h.hotelId}`,
    name: h.name ?? "Hotel",
    city: addr.cityName ?? "",
    country: addr.countryCode ?? "",
    address: [addr.lines?.join(", "), addr.postalCode, addr.cityName]
      .filter(Boolean)
      .join(", "),
    latitude: h.geoCode?.latitude ?? NaN,
    longitude: h.geoCode?.longitude ?? NaN,
    amenities: [],
    images: [], // imagery arrives with hotel-offers content below
  };
}

function mapOffer(offer: any): ProviderRoomOffer {
  const ho = offer.hotel ?? {};
  const first = offer.offers?.[0] ?? {};
  const room = first.roomApproximation ?? first.roomDetails ?? {};
  const rate = Number(first.price?.base ?? first.price?.total ?? 0);
  const total = Number(first.price?.total ?? rate);
  const media: string[] = (ho.media ?? []).map((m: any) => m.uri).filter(Boolean);
  return {
    id: first.id ?? `${ho.hotelId}-offer`,
    roomId: ho.hotelId ?? "",
    roomName: room.roomType?.name ?? room.description?.text?.split(".")[0] ?? "Room offer",
    description: room.description?.text,
    bedType: room.beds?.[0]?.type ?? room.bedConfiguration?.bedType,
    sizeSqm: room.roomSize?.sqm ? Number(room.roomSize.sqm) : undefined,
    capacity: room.maxOccupancy?.total ?? undefined,
    amenities: (room.amenities ?? []).map((a: any) => a.description ?? a),
    mealPlan: first.ratePlans?.[0]?.meals?.map((m: any) => m.description).join(", "),
    cancellationPolicy: first.policies?.cancellation?.description?.text,
    images: media,
    panoramaUrl: media.find((u: string) => /pano|360/i.test(u)),
    modelUrl: undefined,
    rate,
    currency: first.price?.currency ?? "INR",
    taxesAndFees: first.price?.fees
      ? first.price.fees.reduce((s: number, f: any) => s + Number(f.amount ?? 0), 0)
      : first.price?.markups?.reduce((s: number, m: any) => s + Number(m.amount ?? 0), 0),
    totalPrice: total,
    roomsAvailable: Number(first.roomQuantity ?? 1),
    refundable: first.policies?.refundable !== false,
  };
}

export const amadeusProvider: HotelProvider = {
  id: "amadeus",

  isLive() {
    return true;
  },

  async searchHotels(params: ProviderSearch): Promise<ProviderHotel[]> {
    if (params.latitude === undefined || params.longitude === undefined) {
      // Amadeus geocode search requires coordinates; destination resolution
      // happens upstream via our geocoding service.
      return [];
    }
    const data = await amadeusGet<{ data?: any[] }>(
      "/v1/reference-data/locations/hotels/by-geocode",
      {
        latitude: String(params.latitude),
        longitude: String(params.longitude),
        radius: String(params.radiusKm ?? 20),
        radiusUnit: "KM",
        hotelSource: "ALL",
      }
    );
    let hotels = (data.data ?? []).map(mapHotel);
    if (params.query) {
      const q = params.query.toLowerCase();
      hotels = hotels.filter(
        (h) => h.name.toLowerCase().includes(q) || h.city.toLowerCase().includes(q)
      );
    }
    return hotels.slice(0, 30);
  },

  async getRooms({ hotelId, checkIn, checkOut, adults, rooms, currency }): Promise<ProviderRoomOffer[]> {
    const rawId = hotelId.replace(/^amadeus-/, "");
    const data = await amadeusGet<{ data?: any[] }>("/v3/shopping/hotel-offers", {
      hotelIds: rawId,
      checkInDate: checkIn,
      checkOutDate: checkOut,
      adults: String(adults),
      roomQuantity: String(rooms ?? 1),
      currency: currency ?? "INR",
      bestRateOnly: "true",
    });
    return (data.data ?? []).map(mapOffer);
  },
};
