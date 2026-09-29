import { Suspense } from "react";
import Link from "next/link";
import { NearMeControls } from "@/components/near-me-controls";
import { HeroSearch } from "@/components/hero-search";
import { ResultsToolbar } from "@/components/results-toolbar";
import { Reveal } from "@/components/reveal";
import { getProvider, type ProviderHotel } from "@/lib/hotel-provider";
import { AmadeusError } from "@/lib/hotel-provider/amadeus";
import { searchPlaces, reverseGeocode } from "@/lib/geocoding";
import { formatINR, formatDistance } from "@/lib/format";
import { LiveConnectionRequired } from "@/components/live-connection-required";
import { searchDataset } from "@/lib/hotels/hotel-service";
import { DatasetUnavailableError } from "@/lib/hotels/csv-loader";
import { providerMode } from "@/lib/hotel-provider";
import { HotelArt } from "@/components/hotel-art";
import { LocationPermissionBanner } from "@/components/location/location-permission-banner";
import { CurrentLocationChip } from "@/components/location/current-location-chip";
import { NearMeHub } from "@/components/location/near-me-hub";

export const dynamic = "force-dynamic";

interface HomeParams {
  q?: string;
  place?: string;
  checkIn?: string;
  checkOut?: string;
  guests?: string;
  lat?: string;
  lng?: string;
  radius?: string;
  view?: string;
  rooms?: string;
  sort?: string;
  minRating?: string;
  maxPrice?: string;
  roomType?: string;
  city?: string;
  state?: string;
  search?: string;
}

interface HomeProps {
  searchParams: Promise<HomeParams>;
}

export default async function HomePage({ searchParams }: HomeProps) {
  const sp = await searchParams;
  const isNearMe = Boolean(sp.lat && sp.lng);
  return (
    <div>
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-32 left-1/2 h-[420px] w-[820px] -translate-x-1/2 rounded-full opacity-40 blur-3xl"
          style={{ background: "radial-gradient(closest-side, var(--gold), transparent)" }}
        />
        <div className="container-x relative pt-14 pb-10 sm:pt-20">
          <div className="animate-fade-up mx-auto max-w-2xl text-center">
            <div className="mb-3 flex justify-center">
              <Suspense fallback={null}>
                <CurrentLocationChip />
              </Suspense>
            </div>
            <p className="eyebrow">Aurelia · immersive hotel experience</p>
            <h1 className="font-display mt-4 text-4xl leading-[1.06] font-semibold tracking-tight text-balance sm:text-6xl">
              See your stay.{" "}
              <span style={{ color: "var(--accent)" }}>Shape your stay.</span>{" "}
              Live your stay.
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-base sm:text-lg" style={{ color: "var(--muted)" }}>
              Explore real hotels, experience rooms in immersive 3D, compare
              your options, and book your stay with confidence.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <a href="#stays" className="btn-primary">Explore hotels</a>
              <Link href="/rooms" className="btn-secondary">Try the 3D experience</Link>
            </div>
          </div>

          {/* hero search card */}
          <Suspense fallback={<div className="skeleton mx-auto mt-10 h-64 w-full max-w-3xl rounded-3xl" />}>
            <HeroSearch initial={Object.fromEntries(
              Object.entries(sp).filter(([, v]) => v != null) as [string, string][],
            )} />
          </Suspense>

          {/* location permission banner */}
          <div className="mx-auto mt-4 max-w-3xl">
            <Suspense fallback={null}>
              <LocationPermissionBanner />
            </Suspense>
          </div>

          {/* near-me controls */}
          <div id="stays" className="scroll-mt-24" />
          <div className="mx-auto mt-4 w-full max-w-3xl">
            <Suspense fallback={null}>
              <NearMeControls cities={[]} />
            </Suspense>
          </div>

          {/* 3D preview strip */}
          <Reveal delay={120}>
            <section aria-label="3D room experience preview" className="mx-auto mt-10 max-w-3xl">
              <Link
                href="/rooms"
                className="card card-hover group flex items-center gap-4 p-4 sm:gap-6 sm:p-5"
              >
                <HotelArt seed={7} className="h-20 w-28 shrink-0 rounded-xl sm:h-24 sm:w-40" />
                <div className="min-w-0 flex-1">
                  <p className="eyebrow">The centerpiece</p>
                  <h2 className="font-display mt-0.5 text-lg font-semibold sm:text-xl">
                    Walk the room in 3D before you book it
                  </h2>
                  <p className="mt-1 line-clamp-2 text-xs leading-relaxed sm:text-sm" style={{ color: "var(--muted)" }}>
                    Rotate, zoom and open hotspots — bed, bath, view, lighting — or step inside with the walkthrough mode.
                  </p>
                </div>
                <span aria-hidden className="shrink-0 text-xl transition-transform duration-300 group-hover:translate-x-1" style={{ color: "var(--accent)" }}>→</span>
              </Link>
            </section>
          </Reveal>
        </div>
      </section>

      <Suspense key={`${sp.q ?? ""}|${sp.lat ?? ""}|${sp.lng ?? ""}|${sp.sort ?? ""}|${sp.view ?? ""}`} fallback={<ResultsSkeleton />}>
        <ResultsSection sp={sp} />
      </Suspense>

      <Reveal delay={140}>
        <section id="near-me-hub" className="container-x mt-16 scroll-mt-24">
          <Suspense fallback={<div className="skeleton h-96 w-full rounded-2xl" />}>
            <NearMeHub />
          </Suspense>
        </section>
      </Reveal>

      {isNearMe && (
        <Reveal>
          <section className="container-x mt-16">
            <div className="card flex flex-wrap items-center justify-between gap-4 p-5 sm:p-6">
              <div>
                <p className="eyebrow">Don&apos;t just book a room</p>
                <p className="font-display mt-1 text-lg font-semibold">
                  Experience it first. Pay securely. Your stay is now in your hands.
                </p>
              </div>
              <Link href="/rooms" className="btn-secondary">Try the 3D experience</Link>
            </div>
          </section>
        </Reveal>
      )}

      <Reveal>
        <section id="how-it-works" className="container-x mt-20 scroll-mt-24">
          <p className="eyebrow text-center">The full journey</p>
          <h2 className="font-display mt-3 text-center text-3xl font-semibold">
            From first look to fond farewell
          </h2>
        </section>
      </Reveal>
    </div>
  );
}

/* ---------- results ---------- */

function ResultsSkeleton() {
  return (
    <section className="container-x mt-10" aria-busy="true" aria-label="Finding hotels near you">
      <div className="skeleton mb-6 h-8 w-72" />
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="card overflow-hidden p-0">
            <div className="skeleton h-44 w-full rounded-none" />
            <div className="space-y-2 p-5">
              <div className="skeleton h-5 w-3/4" />
              <div className="skeleton h-4 w-1/2" />
              <div className="skeleton h-4 w-1/3" />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function NoticeCard({ title, body }: { title: string; body: string }) {
  return (
    <section className="container-x mt-10">
      <div className="card mx-auto max-w-xl p-10 text-center">
        <p className="font-display text-xl font-semibold">{title}</p>
        <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--muted)" }}>{body}</p>
      </div>
    </section>
  );
}

function DatasetUnavailableNotice() {
  return (
    <NoticeCard
      title="Hotel dataset unavailable."
      body="Please configure the Aurelia hotel dataset (data/hotels_india_live_locations.csv) and restart."
    />
  );
}

async function ResultsSection({ sp }: { sp: HomeParams }) {

  if (!getProvider()) {
    return <LiveConnectionRequired />;
  }

  const hasCoords =
    Number.isFinite(Number.parseFloat(sp.lat ?? "")) &&
    Number.isFinite(Number.parseFloat(sp.lng ?? ""));

  if (!hasCoords && !sp.q) {
    return (
      <NoticeCard
        title="Search any destination worldwide"
        body="Pick a city — or use your current location — and Aurelia will query live hotel inventory for real availability and ₹ pricing."
      />
    );
  }

  // Stream the actual provider search.
  return (
    <Suspense key={`${sp.q ?? ""}|${sp.lat ?? ""}|${sp.lng ?? ""}|${sp.checkIn ?? ""}`} fallback={<ResultsSkeleton />}>
      <LiveResults sp={sp} />
    </Suspense>
  );
}

async function LiveResults({ sp }: { sp: HomeParams }) {
  const provider = getProvider();
  if (!provider) return <LiveConnectionRequired />;

  let latitude = Number.parseFloat(sp.lat ?? "");
  let longitude = Number.parseFloat(sp.lng ?? "");
  let label = sp.place ?? "";

  if (Number.isFinite(latitude) && Number.isFinite(longitude) && !label) {
    try {
      const place = await reverseGeocode(latitude, longitude);
      if (place?.name || place?.label) {
        label = place.name || place.label.split(",")[0] || place.label;
      }
    } catch {}
  }

  // Destination resolution: typed query → real coordinates via geocoder.
  let destFailure: "not-found" | "lookup-failed" | null = null;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    try {
      const places = await searchPlaces(sp.q ?? "");
      if (!places.length) {
        destFailure = "not-found";
      } else {
        ({ latitude, longitude } = places[0]);
        label = places[0].label;
      }
    } catch {
      destFailure = "lookup-failed";
    }
  }
  if (destFailure === "not-found") {
    return (
      <NoticeCard
        title="Destination not found"
        body={`We couldn't resolve “${sp.q}”. Please try another location.`}
      />
    );
  }
  if (destFailure === "lookup-failed") {
    return (
      <NoticeCard
        title="Destination lookup failed"
        body="We couldn't reach the location service right now. Please try again."
      />
    );
  }

  const radiusKm = Number.parseInt(sp.radius ?? "", 10) || undefined;

  let hotels: ProviderHotel[];
  try {
    if (providerMode() === "csv") {
      const rows = await searchDataset({
        search: Number.isFinite(latitude) ? undefined : (sp.search ?? sp.q ?? sp.place),
        latitude: Number.isFinite(latitude) ? latitude : undefined,
        longitude: Number.isFinite(longitude) ? longitude : undefined,
        radiusKm,
        checkIn: sp.checkIn, checkOut: sp.checkOut,
        rooms: Number.parseInt(sp.rooms ?? "1", 10) || 1,
        sort: sp.sort, minRating: sp.minRating ? Number(sp.minRating) : undefined,
        maxPrice: sp.maxPrice ? Number(sp.maxPrice) : undefined,
        roomType: sp.roomType,
        city: Number.isFinite(latitude) ? undefined : sp.city,
        state: Number.isFinite(latitude) ? undefined : sp.state,
        // free-text destination also matches city/state/name via the service

      });
      hotels = rows.map((r): ProviderHotel => ({ ...r, id: r.hotel_id, slug: r.hotel_id, country: r.state, images: [], amenities: [], priceCurrency: "INR" }));
    } else {
      hotels = await provider.searchHotels({
        latitude, longitude, radiusKm,
        checkIn: sp.checkIn ?? "", checkOut: sp.checkOut ?? "",
        adults: Number.parseInt(sp.guests ?? "2", 10) || 2,
      });
    }
  } catch (e) {
    if (e instanceof DatasetUnavailableError) return <DatasetUnavailableNotice />;
    const authFailed = e instanceof AmadeusError && e.kind === "auth";
    return (
      <NoticeCard
        title={
          authFailed
            ? "Unable to authenticate with the hotel provider."
            : "Live hotel service is temporarily unavailable."
        }
        body={
          authFailed
            ? "Please verify your Amadeus API credentials."
            : "Please try again in a moment."
        }
      />
    );
  }

  const heading = label
    ? `Stays in ${label}`
    : isNearMeSearch(sp)
      ? "Hotels near you"
      : "Stays";

  if (!hotels.length) {
    return (
      <>
        <ResultsHeader label={heading} count={0} sp={sp} latitude={latitude} longitude={longitude} />
        <NoticeCard
          title="No real hotels available for this location and selected dates."
          body="Try another destination, different dates, or widen the radius — Aurelia shows only genuinely available properties."
        />
      </>
    );
  }

  const isList = sp.view === "list";
  return (
    <section className="container-x mt-10">
      <ResultsHeader label={heading} count={hotels.length} sp={sp} latitude={latitude} longitude={longitude} />
      <Suspense fallback={null}>
        <ResultsToolbar resultCount={hotels.length} />
      </Suspense>
      <div
        className={
          isList
            ? "mt-6 flex flex-col gap-4"
            : "mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3"
        }
      >
        {hotels.map((h, i) => (
          <Reveal key={h.id} delay={Math.min(i * 50, 300)}>
            <DatasetHotelCard hotel={h} variant={isList ? "list" : "grid"} distanceKm={h.distanceKm} />
          </Reveal>
        ))}
      </div>
    </section>
  );
}

function isNearMeSearch(sp: HomeParams): boolean {
  return Boolean(
    Number.isFinite(Number.parseFloat(sp.lat ?? "")) && Number.isFinite(Number.parseFloat(sp.lng ?? "")),
  );
}

function ResultsHeader({
  label,
  count,
  sp,
  latitude,
  longitude,
}: {
  label: string;
  count: number;
  sp: HomeParams;
  latitude: number;
  longitude: number;
}) {
  void sp;
  void latitude;
  void longitude;
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="font-display text-2xl font-semibold">{label}</h2>
        <p className="mt-0.5 text-sm" style={{ color: "var(--muted)" }}>
          {count > 0 ? `${count} ${count === 1 ? "property" : "properties"} · live inventory` : ""}
        </p>
      </div>
      <span
        className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold tracking-wide"
        style={{ background: "color-mix(in srgb, var(--pine) 14%, transparent)", color: "var(--pine)" }}
      >
        <span aria-hidden className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60" style={{ background: "var(--pine)" }} />
          <span className="relative inline-flex h-2 w-2 rounded-full" style={{ background: "var(--pine)" }} />
        </span>
        Live availability
      </span>
    </div>
  );
}

function DatasetHotelCard({
  hotel,
  variant = "grid",
  distanceKm,
}: {
  hotel: ProviderHotel & { room_type?: string; rooms_available?: number; available_from?: string; available_to?: string; rating_count?: number };
  variant?: "grid" | "list";
  distanceKm?: number;
}) {
  const artSeed = [...hotel.id].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
  const qs = new URLSearchParams();
  if (distanceKm != null) qs.set("near", "1");

  if (variant === "list") {
    return (
      <div className="card card-hover group flex flex-col overflow-hidden p-0 sm:flex-row">
        <Link href={`/hotels/${hotel.slug}`} className="relative block shrink-0 sm:w-64" aria-label={`View ${hotel.name}`}>
          <HotelArt seed={artSeed} className="h-40 w-full transition-transform duration-500 group-hover:scale-[1.04] sm:h-full" />
        </Link>
        <div className="flex min-w-0 flex-1 flex-col p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="eyebrow mb-0.5">{hotel.city}{hotel.country ? `, ${hotel.country}` : ""}</p>
              <Link href={`/hotels/${hotel.slug}`} className="font-display text-lg font-semibold hover:text-accent transition-colors sm:text-xl">
                {hotel.name}
              </Link>
            </div>
            <span className="flex shrink-0 items-center gap-1 rounded-full border border-line px-2.5 py-1 text-xs font-semibold">
              ★ {hotel.rating?.toFixed(1)}
              {hotel.rating_count ? <span style={{ color: "var(--muted)" }}> · {hotel.rating_count.toLocaleString("en-IN")}</span> : null}
            </span>
          </div>
          {distanceKm != null && (
            <p className="mt-1 text-xs font-semibold" style={{ color: "var(--pine)" }}>
              📍 {formatDistance(distanceKm)}
            </p>
          )}
          <p className="mt-1 line-clamp-1 text-xs" style={{ color: "var(--muted)" }}>{hotel.address}</p>
          <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-4">
            <div>
              <p className="font-display text-xl font-semibold">
                {formatINR(hotel.priceFrom ?? 0)} <span className="text-xs font-normal" style={{ color: "var(--muted)" }}>/ night</span>
              </p>
              <p className="text-[11px]" style={{ color: "var(--muted)" }}>
                {hotel.room_type} · {hotel.rooms_available} room{hotel.rooms_available === 1 ? "" : "s"} available
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold tracking-wide uppercase" style={{ background: "color-mix(in srgb, var(--gold) 16%, transparent)", color: "var(--accent-strong)" }}>
                ◉ 3D room available
              </span>
              <Link href={`/hotels/${hotel.slug}`} className="btn-secondary !px-4 !py-2 text-xs">Explore</Link>
              <Link href={`/book/${hotel.slug}`} className="btn-primary !px-4 !py-2 text-xs">Select room</Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="card card-hover group flex h-full flex-col overflow-hidden p-0">
      <Link href={`/hotels/${hotel.slug}`} className="focus-visible:outline-accent relative block focus-visible:-outline-offset-2 focus-visible:outline-2" aria-label={`View details for ${hotel.name}`}>
        <div className="relative aspect-[16/10] overflow-hidden">
          <HotelArt seed={artSeed} className="h-full w-full transition-transform duration-500 group-hover:scale-[1.05]" />
          <span
            className="glass absolute top-3 left-3 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold tracking-wide text-white uppercase"
            style={{ textShadow: "0 1px 2px rgb(0 0 0 / 0.4)" }}
          >
            ◉ 3D room
          </span>
          {distanceKm != null && (
            <span className="absolute right-3 bottom-3 rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-bold text-white backdrop-blur-sm">
              📍 {formatDistance(distanceKm)}
            </span>
          )}
        </div>
      </Link>
      <div className="flex min-w-0 flex-1 flex-col p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="eyebrow mb-0.5 truncate">{hotel.city}</p>
            <Link href={`/hotels/${hotel.slug}`} className="font-display line-clamp-1 text-lg leading-snug font-semibold hover:text-accent transition-colors">
              {hotel.name}
            </Link>
          </div>
          <span className="mt-0.5 flex shrink-0 items-center gap-1 rounded-full border border-line px-2.5 py-1 text-xs font-semibold">
            ★ {hotel.rating?.toFixed(1)}
          </span>
        </div>
        <p className="mt-1.5 line-clamp-1 text-xs" style={{ color: "var(--muted)" }}>{hotel.address}</p>

        <div className="mt-auto space-y-3 pt-4">
          <div className="flex items-center justify-between border-t border-line pt-3">
            <div>
              <p className="text-[11px]" style={{ color: "var(--muted)" }}>from</p>
              <p className="font-display text-xl leading-none font-semibold">
                {formatINR(hotel.priceFrom ?? 0)}
                <span className="text-xs font-normal" style={{ color: "var(--muted)" }}> /night</span>
              </p>
            </div>
            <p className="text-right text-[11px]" style={{ color: "var(--pine)" }}>
              {hotel.rooms_available} room{hotel.rooms_available === 1 ? "" : "s"} free
              <span className="block" style={{ color: "var(--muted)" }}>
                {hotel.room_type}
              </span>
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Link href={`/hotels/${hotel.slug}`} className="btn-secondary !px-3 !py-2.5 text-center text-xs">View details</Link>
            <Link href={`/book/${hotel.slug}?${qs.toString()}`} className="btn-primary !px-3 !py-2.5 text-center text-xs">Select room</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
