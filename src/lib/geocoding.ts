/**
 * Worldwide location search + reverse geocoding.
 *
 * Provider: OpenStreetMap Nominatim (free, no API key) behind a thin
 * provider-agnostic interface so it can be swapped for Google Places,
 * Mapbox, Photon, etc. later. All calls are server-side (see
 * /api/geo/* routes): they set a proper User-Agent per Nominatim's usage
 * policy, cache responses briefly, and time out fast.
 */

export interface GeoPlace {
  id: string;
  /** Human-readable "City, Region, Country" label. */
  label: string;
  name: string;
  region?: string;
  country?: string;
  latitude: number;
  longitude: number;
  kind: string;
}

const NOMINATIM_BASE = "https://nominatim.openstreetmap.org";
const USER_AGENT = "Aurelia-Hotel-Demo/1.0 (booking demo; contact: demo@aurelia.test)";
const TIMEOUT_MS = 4500;

interface CacheEntry<T> {
  at: number;
  value: T;
}
const CACHE_TTL_MS = 10 * 60 * 1000;
const cache = new Map<string, CacheEntry<unknown>>();

function fromCache<T>(key: string): T | undefined {
  const hit = cache.get(key);
  if (!hit) return undefined;
  if (Date.now() - hit.at > CACHE_TTL_MS) {
    cache.delete(key);
    return undefined;
  }
  return hit.value as T;
}

function toCache<T>(key: string, value: T): T {
  // keep the cache bounded
  if (cache.size > 500) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, { at: Date.now(), value });
  return value;
}

async function nominatim(path: string, params: Record<string, string>): Promise<unknown> {
  const qs = new URLSearchParams({ format: "jsonv2", addressdetails: "1", "accept-language": "en", ...params });
  const res = await fetch(`${NOMINATIM_BASE}${path}?${qs.toString()}`, {
    headers: { "User-Agent": USER_AGENT },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    // never let Next cache stale geo answers beyond our own TTL policy
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Geocoder responded ${res.status}`);
  return res.json();
}

/** "Bhubaneswar, Odisha, India" — city-level part first, skipping duplicates. */
export function buildLabel(parts: Array<string | undefined>): string {
  const seen = new Set<string>();
  return parts
    .filter((p): p is string => Boolean(p))
    .filter((p) => {
      const k = p.toLowerCase();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .slice(0, 3)
    .join(", ");
}

interface NominatimAddress {
  city?: string;
  town?: string;
  village?: string;
  municipality?: string;
  suburb?: string;
  county?: string;
  district?: string;
  state_district?: string;
  state?: string;
  region?: string;
  country?: string;
}

interface NominatimResult {
  place_id: number;
  osm_type?: string;
  osm_id?: number;
  lat: string;
  lon: string;
  name?: string;
  type?: string;
  class?: string;
  display_name: string;
  address?: NominatimAddress;
}

function primaryName(r: NominatimResult): string {
  if (r.name) return r.name;
  const a = r.address ?? {};
  return a.city ?? a.town ?? a.village ?? a.municipality ?? r.display_name.split(",")[0] ?? r.display_name;
}

export function toGeoPlace(r: NominatimResult): GeoPlace {
  const a = r.address ?? {};
  const label =
    buildLabel([primaryName(r), a.state ?? a.region ?? a.county, a.country]) ||
    r.display_name.split(",").slice(0, 3).join(",").trim();
  return {
    id: `${r.osm_type ?? r.class ?? "p"}-${r.osm_id ?? r.place_id}`,
    label,
    name: primaryName(r),
    region: a.state ?? a.region,
    country: a.country,
    latitude: Number.parseFloat(r.lat),
    longitude: Number.parseFloat(r.lon),
    kind: r.type ?? r.class ?? "place",
  };
}

/** Forward search: cities, regions, countries, landmarks, addresses — worldwide. */
export async function searchPlaces(query: string): Promise<GeoPlace[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const key = `s:${q.toLowerCase()}`;
  const cached = fromCache<GeoPlace[]>(key);
  if (cached) return cached;

  const raw = (await nominatim("/search", {
    q,
    limit: "6",
    featuretype: "",
  })) as NominatimResult[];

  const seen = new Set<string>();
  const places = (Array.isArray(raw) ? raw : [])
    .map(toGeoPlace)
    .filter((p) => Number.isFinite(p.latitude) && Number.isFinite(p.longitude))
    .filter((p) => {
      if (seen.has(p.label)) return false;
      seen.add(p.label);
      return true;
    });

  return toCache(key, places);
}

/** Reverse geocode coordinates into "City, Region, Country". */
export async function reverseGeocode(latitude: number, longitude: number): Promise<GeoPlace | null> {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  const key = `r:${latitude.toFixed(4)},${longitude.toFixed(4)}`;
  const cached = fromCache<GeoPlace | null>(key);
  if (cached !== undefined) return cached;

  try {
    const raw = await nominatim("/reverse", {
      lat: String(latitude),
      lon: String(longitude),
      zoom: "12",
    });

    if (raw && typeof raw === "object" && "lat" in raw) {
      return toCache(key, toGeoPlace(raw as NominatimResult));
    }
  } catch (err) {
    console.warn("Reverse geocode request failed:", err);
  }

  // Never return a fake or unrelated city name. If reverse geocoding is unavailable,
  // return null so the caller uses the exact GPS coordinates without fake city substitution.
  return toCache(key, null);
}

/* ── Detailed reverse geocoding (for location verification) ─────────── */

export interface DetailedAddress {
  formatted: string;
  country: string | null;
  state: string | null;
  district: string | null;
  city: string | null;
}

/** Reverse geocode with full administrative breakdown for verification flows. */
export async function reverseGeocodeDetailed(latitude: number, longitude: number): Promise<DetailedAddress | null> {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  const key = `rd:${latitude.toFixed(4)},${longitude.toFixed(4)}`;
  const cached = fromCache<DetailedAddress | null>(key);
  if (cached !== undefined) return cached;

  try {
    const raw = await nominatim("/reverse", {
      lat: String(latitude),
      lon: String(longitude),
      zoom: "14",
    });
    if (raw && typeof raw === "object" && "lat" in raw) {
      const r = raw as NominatimResult & { display_name: string };
      const a = r.address ?? {};
      const result: DetailedAddress = {
        formatted: r.display_name,
        country: a.country ?? null,
        state: a.state ?? a.region ?? null,
        district: a.county ?? a.district ?? a.state_district ?? null,
        city: a.city ?? a.town ?? a.village ?? a.municipality ?? a.suburb ?? null,
      };
      return toCache(key, result);
    }
  } catch (err) {
    console.warn("Detailed reverse geocode failed:", err);
  }

  return toCache(key, null);
}
