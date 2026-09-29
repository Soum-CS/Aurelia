import Link from "next/link";
import type { Metadata } from "next";
import { addDays, formatINR, toISODate } from "@/lib/format";
import { getProvider } from "@/lib/hotel-provider";
import { AmadeusError } from "@/lib/hotel-provider/amadeus";
import { providerMode } from "@/lib/hotel-provider";
import { getDatasetHotel } from "@/lib/hotels/csv-provider";
import { LiveConnectionRequired } from "@/components/live-connection-required";
import { HotelArt } from "@/components/hotel-art";
import { ExplorerLazy } from "@/components/room3d/explorer-lazy";
import { ViewerFrame } from "@/components/viewer-frame";
import { datasetRoomScene } from "@/lib/hotels/room-scene";
import { AirportTransferCard } from "@/components/location/airport-transfer-card";

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ checkIn?: string; checkOut?: string; adults?: string; name?: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  return { title: slug.startsWith("amadeus-") ? "Hotel · Aurelia" : "Hotel" };
}

function Notice({ title, body }: { title: string; body: string }) {
  return (
    <div className="card mx-auto mt-16 max-w-xl p-10 text-center">
      <p className="font-display text-xl font-semibold">{title}</p>
      <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--muted)" }}>{body}</p>
      <Link href="/" className="btn-secondary mt-6 inline-flex">Back to search</Link>
    </div>
  );
}

/**
 * Hotel detail. Demo entities are unreachable: without a configured live
 * provider this route always shows the connection-required notice.
 */
export default async function HotelPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const sp = await searchParams;
  const provider = getProvider();

  // Dataset mode: serve configured-dataset records by hotel_id.
  if (providerMode() === "csv") {
    let row: Awaited<ReturnType<typeof getDatasetHotel>>;
    try { row = await getDatasetHotel(slug); } catch { row = null; }
    if (row) return <DatasetHotelDetail h={row} checkIn={sp.checkIn ?? ""} checkOut={sp.checkOut ?? ""} />;
    return (
      <div className="container-x pt-10 pb-4"><LiveConnectionRequired /></div>
    );
  }
  if (!provider || !slug.startsWith("amadeus-")) {
    return (
      <div className="container-x pt-10 pb-4">
        <LiveConnectionRequired />
      </div>
    );
  }

  const name = sp.name ?? "Hotel";
  const checkIn = sp.checkIn ?? toISODate(addDays(new Date(), 7));
  const checkOut = sp.checkOut ?? toISODate(addDays(new Date(), 10));
  const adults = Number.parseInt(sp.adults ?? "2", 10) || 2;

  let rooms;
  try {
    rooms = await provider.getRooms({
      hotelId: slug,
      checkIn,
      checkOut,
      adults,
    });
  } catch (e) {
    const authFailed = e instanceof AmadeusError && e.kind === "auth";
    return (
      <div className="container-x pt-10 pb-4">
        <Notice
          title={
            authFailed
              ? "Unable to authenticate with the hotel provider."
              : "Live hotel service is currently unavailable."
          }
          body={
            authFailed
              ? "Please verify your Amadeus API credentials."
              : "We couldn't retrieve this property right now. Please try again."
          }
        />
      </div>
    );
  }

  const bookable = rooms.filter((r) => r.roomsAvailable > 0);

  return (
    <div className="container-x pt-8 pb-4">
      <nav aria-label="Breadcrumb" className="mb-5 text-sm" style={{ color: "var(--muted)" }}>
        <Link href="/" className="hover:text-accent transition-colors">Stays</Link>
        <span aria-hidden className="mx-2">/</span>
        <span style={{ color: "var(--ink)" }}>{name}</span>
      </nav>

      <p className="eyebrow mb-1">Live inventory</p>
      <h1 className="font-display text-3xl font-semibold sm:text-4xl">{name}</h1>
      <p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>
        {formatINR(0).replace("₹0", "")}Rates for {checkIn} → {checkOut} · {adults}{" "}
        {adults === 1 ? "guest" : "guests"} · requested in INR
      </p>

      <h2 className="font-display mt-10 text-2xl font-semibold">
        {bookable.length > 0 ? "Available rooms" : "No available rooms for your selected dates."}
      </h2>

      {bookable.length === 0 && rooms.length === 0 && (
        <p className="mt-3 text-sm" style={{ color: "var(--muted)" }}>
          The provider returned no offers for these dates. Try different dates or another property.
        </p>
      )}

      <ul className="mt-5 space-y-5">
        {bookable.map((r) => (
          <li key={r.id} className="card p-5 sm:p-7">
            <div className="flex flex-col gap-6 lg:flex-row">
              <div className="flex-1">
                <h3 className="font-display text-xl font-semibold">{r.roomName}</h3>
                {r.description && (
                  <p className="mt-2 max-w-2xl text-sm leading-relaxed" style={{ color: "var(--muted)" }}>
                    {r.description}
                  </p>
                )}
                <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-1.5 text-xs" style={{ color: "var(--muted)" }}>
                  {r.sizeSqm ? <li>{r.sizeSqm} m²</li> : null}
                  {r.bedType ? <li>{r.bedType}</li> : null}
                  {r.capacity ? <li>Sleeps {r.capacity}</li> : null}
                  {r.mealPlan ? <li>{r.mealPlan}</li> : null}
                  {r.cancellationPolicy ? <li>{r.cancellationPolicy}</li> : null}
                </ul>
              </div>
              <div className="shrink-0 lg:w-64 lg:border-l lg:border-line lg:pl-7 lg:text-right">
                {r.images.length > 0 ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={r.images[0]} alt={`Photo of ${r.roomName}`} className="mb-4 h-32 w-full rounded-xl object-cover lg:hidden" loading="lazy" />
                ) : (
                  <div className="mb-4 flex h-32 w-full items-center justify-center rounded-xl text-xs" style={{ background: "var(--line)", color: "var(--muted)" }}>
                    Room image unavailable
                  </div>
                )}
                <p className="text-xs" style={{ color: "var(--muted)" }}>Current rate</p>
                <p className="font-display text-2xl font-semibold">
                  {formatINR(r.currency === "INR" ? r.rate : r.totalPrice ?? r.rate)}
                  <span className="text-sm font-normal" style={{ color: "var(--muted)" }}> /night</span>
                </p>
                {r.taxesAndFees ? (
                  <p className="mt-1 text-xs" style={{ color: "var(--muted)" }}>
                    + {formatINR(r.currency === "INR" ? r.taxesAndFees : 0)} taxes & fees (as reported)
                  </p>
                ) : null}
                <p className="mt-4 rounded-xl px-3 py-2 text-xs leading-relaxed" style={{ background: "color-mix(in srgb, var(--gold) 12%, transparent)", color: "var(--accent-strong)" }}>
                  Partner booking flow required — direct booking isn&apos;t enabled for
                  this provider account, so Aurelia won&apos;t create a booking record.
                </p>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function DatasetHotelDetail({ h, checkIn, checkOut }: { h: NonNullable<Awaited<ReturnType<typeof getDatasetHotel>>>; checkIn: string; checkOut: string }) {
  const fmt = (d: string) => new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  const qs = new URLSearchParams({ checkIn: checkIn || "", checkOut: checkOut || "" });
  const artSeed = [...h.hotel_id].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
  return (
    <div>
      {/* ── cinematic hero ── */}
      <section className="relative">
        <div className="absolute inset-0 overflow-hidden" aria-hidden>
          <HotelArt seed={artSeed} className="h-full w-full opacity-90" />
          <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgb(0 0 0 / 0.72), rgb(0 0 0 / 0.25) 55%, transparent)" }} />
        </div>
        <div className="container-x relative pt-24 pb-10 sm:pt-36 sm:pb-14">
          <nav aria-label="Breadcrumb" className="no-print mb-4 text-sm text-white/80">
            <Link href="/" className="hover:text-white transition-colors">Search</Link>
            <span aria-hidden className="mx-2">/</span>
            <span className="text-white">{h.name}</span>
          </nav>
          <p className="eyebrow animate-fade-up">{h.hotel_id} · verified property</p>
          <h1 className="animate-fade-up font-display mt-2 max-w-3xl text-4xl leading-[1.05] font-semibold tracking-tight text-white text-balance sm:text-6xl">
            {h.name}
          </h1>
          <div className="animate-fade-up mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-white/90">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-black/40 px-3 py-1 font-semibold backdrop-blur-sm">
              ★ {h.rating.toFixed(1)}
              <span className="font-normal opacity-80">· {h.rating_count.toLocaleString("en-IN")} reviews</span>
            </span>
            <span>📍 {h.city}, {h.state}</span>
            <span className="hidden sm:inline">{h.phone_number}</span>
            <span className="rounded-full px-3 py-1 font-display text-lg font-semibold text-white" style={{ background: "color-mix(in srgb, var(--gold) 82%, transparent)" }}>
              {formatINR(h.price_per_night_inr)}<span className="text-xs font-normal opacity-90"> /night</span>
            </span>
          </div>
        </div>
      </section>

      {/* ── hotel information ── */}
      <section aria-label="Hotel information" className="container-x -mt-8 relative z-10">
        <div className="card grid grid-cols-2 gap-x-6 gap-y-4 p-5 text-sm sm:grid-cols-4 sm:p-6">
          {[
            ["Location", `${h.address}`],
            ["Coordinates", `${h.latitude.toFixed(4)}, ${h.longitude.toFixed(4)}`],
            ["Availability window", `${fmt(h.available_from)} → ${fmt(h.available_to)}`],
            ["Contact", h.phone_number],
          ].map(([k, v]) => (
            <div key={k}>
              <p className="text-[11px] font-semibold tracking-wide uppercase" style={{ color: "var(--muted)" }}>{k}</p>
              <p className="mt-1 font-medium leading-snug">{v}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── room selection ── */}
      <section aria-label="Rooms" className="container-x mt-12">
        <p className="eyebrow">Room selection</p>
        <h2 className="font-display mt-1 text-2xl font-semibold sm:text-3xl">Choose your room</h2>

        <div className="card card-hover mt-5 flex flex-col overflow-hidden p-0 lg:flex-row">
          {/* room visual */}
          <Link
            href="#3d"
            className="relative block shrink-0 lg:w-[420px]"
            aria-label={`Explore the ${h.room_type} room in 3D`}
          >
            <div className="relative aspect-[16/10] overflow-hidden lg:h-full">
              <HotelArt seed={artSeed + 13} className="h-full w-full transition-transform duration-500 hover:scale-[1.04]" />
              <span className="glass absolute top-3 left-3 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold tracking-wide uppercase">
                ◉ Interactive twin ready
              </span>
            </div>
          </Link>

          <div className="flex min-w-0 flex-1 flex-col p-6 sm:p-7">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="font-display text-xl font-semibold">{h.room_type}</h3>
                <p className="mt-1 text-xs" style={{ color: "var(--muted)" }}>Room type at this property · sleeps 2</p>
              </div>
              <div className="text-right">
                <p className="font-display text-2xl font-semibold">
                  {formatINR(h.price_per_night_inr)}
                  <span className="text-xs font-normal" style={{ color: "var(--muted)" }}> / night</span>
                </p>
                <p className="text-xs" style={{ color: h.rooms_available > 0 ? "var(--pine)" : "#b03a2e" }}>
                  {h.rooms_available > 0
                    ? `${h.rooms_available} room${h.rooms_available === 1 ? "" : "s"} available`
                    : "No rooms available"}
                </p>
              </div>
            </div>

            <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-1.5 text-xs" style={{ color: "var(--muted)" }}>
              <li>🛏 {h.room_type} bedding</li>
              <li>📅 Bookable {fmt(h.available_from)} – {fmt(h.available_to)}</li>
              <li>✓ Live dataset pricing</li>
              <li>✓ Free cancellation window per policy</li>
            </ul>

            <dl className="mt-5 grid grid-cols-2 gap-4 rounded-2xl bg-raised p-4 text-sm sm:grid-cols-3">
              <div>
                <dt className="label !mb-0.5">Check-in</dt>
                <dd>{checkIn ? fmt(checkIn) : "Select dates"}</dd>
              </div>
              <div>
                <dt className="label !mb-0.5">Check-out</dt>
                <dd>{checkOut ? fmt(checkOut) : "Select dates"}</dd>
              </div>
              <div>
                <dt className="label !mb-0.5">Guests</dt>
                <dd>Set at checkout</dd>
              </div>
            </dl>

            <div className="mt-auto flex flex-wrap gap-3 pt-6">
              <Link href="#3d" className="btn-secondary flex-1 sm:flex-none">
                Explore room in 3D
              </Link>
              <Link href={`/book/${h.hotel_id}?${qs.toString()}`} className="btn-primary flex-1 sm:flex-none">
                Select room → continue to book
              </Link>
            </div>
          </div>
        </div>
        {!checkIn || !checkOut ? (
          <p className="mt-3 text-xs" style={{ color: "var(--muted)" }}>
            Tip: pick your dates on the homepage search and they&apos;ll carry into checkout.
          </p>
        ) : null}
      </section>

      {/* ── interactive concept twin ── */}
      <section id="3d" className="container-x mt-14 scroll-mt-20" aria-label="Interactive 3D room experience">
        <p className="eyebrow">✨ See your room before you book</p>
        <h2 className="font-display mt-1 text-2xl font-semibold sm:text-3xl">
          {h.room_type} Room — 3D experience
        </h2>
        <div className="relative mt-4">
          <ViewerFrame>
            <ExplorerLazy
              sceneJson={datasetRoomScene(h.hotel_id, h.room_type)}
              meta={{
                roomName: `${h.room_type} Room`,
                hotelName: h.name,
                bedType: h.room_type,
                viewLabel: "the city",
                capacity: 2,
                sizeSqm: 0,
                artSeed,
              }}
            />
          </ViewerFrame>
          <div className="glass pointer-events-none absolute top-12 left-3 z-10 max-w-56 rounded-2xl p-4 shadow-lg">
            <p className="eyebrow">{h.room_type} room</p>
            <p className="font-display mt-1 text-xl font-semibold">
              {formatINR(h.price_per_night_inr)}<span className="text-xs font-normal" style={{ color: "var(--muted)" }}> / night</span>
            </p>
            <p className="mt-1 text-[11px] leading-relaxed" style={{ color: "var(--muted)" }}>
              {h.rooms_available} {h.rooms_available === 1 ? "room" : "rooms"} available · Rotate • Zoom • Explore
            </p>
            <Link href={`/book/${h.hotel_id}?${qs.toString()}`} className="btn-primary pointer-events-auto mt-3 !px-4 !py-2 w-full text-center text-xs">
              Select this room
            </Link>
          </div>
          <p className="mt-2 text-[11px]" style={{ color: "var(--muted)" }}>
            Concept twin rendered by Aurelia from the room configuration — not a photograph or scan of the actual room.
          </p>
        </div>
      </section>

      {/* ── nearby & location ── */}
      <section aria-label="Location" className="container-x mt-14 pb-16">
        <p className="eyebrow">Location & nearby</p>
        <h2 className="font-display mt-1 text-2xl font-semibold">Getting there</h2>
        <div className="card mt-4 flex flex-wrap items-center justify-between gap-4 p-6">
          <div>
            <p className="text-sm font-medium">{h.address}</p>
            <p className="mt-1 text-xs" style={{ color: "var(--muted)" }}>
              {h.latitude.toFixed(5)}, {h.longitude.toFixed(5)}
            </p>
          </div>
          <a
            href={`https://www.openstreetmap.org/?mlat=${h.latitude}&mlon=${h.longitude}#map=16/${h.latitude}/${h.longitude}`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-secondary"
          >
            Open in maps ↗
          </a>
        </div>

        <div id="airport-transfer" className="mt-8">
          <AirportTransferCard
            hotelId={h.hotel_id}
            hotelName={h.name}
            hotelLat={h.latitude}
            hotelLng={h.longitude}
          />
        </div>

        <div className="no-print card mt-8 flex flex-wrap items-center justify-between gap-4 p-6">
          <div>
            <p className="label">Booking summary</p>
            <p className="text-sm">{checkIn || "—"} → {checkOut || "—"} · {h.room_type} room</p>
          </div>
          <Link href={`/book/${h.hotel_id}?${qs.toString()}`} className="btn-primary">Continue to book</Link>
        </div>
      </section>
    </div>
  );
}
