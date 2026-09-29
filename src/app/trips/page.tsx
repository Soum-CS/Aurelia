import Link from "next/link";
import type { Metadata } from "next";
import { getUserBookings } from "@/lib/data";
import { findUserByToken, getUserToken, computeLoyalty } from "@/lib/user";
import { formatDate } from "@/lib/format";
import { formatINR } from "@/lib/format";
import { getUsdToInrRate, usdMoneyText } from "@/lib/currency";
import { HotelArt } from "@/components/hotel-art";
import { Countdown } from "@/components/countdown";

export const metadata: Metadata = { title: "My trips" };
export const dynamic = "force-dynamic";

function statusLabel(s: string): string {
  switch (s) {
    case "CONFIRMED": return "Upcoming";
    case "CHECKED_IN": return "Checked in";
    case "CHECKED_OUT": return "Completed";
    default: return s;
  }
}

export default async function TripsPage() {
  const inr = await getUsdToInrRate();
  const token = await getUserToken();
  const user = await findUserByToken(token);
  const bookings = user ? await getUserBookings(user.id) : [];

  const completedNights = bookings
    .filter((b) => b.status === "CHECKED_OUT")
    .reduce((sum, b) => sum + b.nights, 0);
  const loyalty = computeLoyalty(completedNights, bookings.filter((b) => b.status === "CHECKED_OUT").length);

  const active = bookings.filter((b) => b.status === "CHECKED_IN");
  const upcoming = bookings.filter((b) => b.status === "CONFIRMED");
  const past = bookings.filter((b) => b.status === "CHECKED_OUT");

  if (bookings.length === 0) {
    return (
      <div className="container-x py-24 text-center">
        <p className="eyebrow">My trips</p>
        <h1 className="font-display mt-3 text-4xl font-semibold">Nothing on the calendar yet</h1>
        <p className="mx-auto mt-3 max-w-md text-sm" style={{ color: "var(--muted)" }}>
          Book a stay and this becomes your journey dashboard — countdown to arrival,
          digital check-in, your key card, in-stay services and checkout.
        </p>
        <Link href="/" className="btn-primary mt-8">Find a stay</Link>
      </div>
    );
  }

  return (
    <div className="container-x pt-10 pb-4">
      <p className="eyebrow">My trips</p>
      <h1 className="font-display mt-2 mb-8 text-3xl font-semibold sm:text-4xl">
        Your journeys, in order
      </h1>

      {/* loyalty strip */}
      <section aria-label="Loyalty status" className="card mb-10 p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold tracking-[0.14em] uppercase" style={{ color: "var(--muted)" }}>
              Aurelia Rewards · {loyalty.tier}
            </p>
            <p className="font-display mt-1 text-lg font-semibold">
              {loyalty.completedNights} nights · {loyalty.stayCount}{" "}
              {loyalty.stayCount === 1 ? "stay" : "stays"}
            </p>
            <p className="text-xs" style={{ color: "var(--muted)" }}>
              {loyalty.nextTier
                ? `${loyalty.nightsToNextTier} more night${loyalty.nightsToNextTier === 1 ? "" : "s"} to ${loyalty.nextTier}`
                : "Top tier — the penthouse of perks"}
            </p>
          </div>
          <div
            role="progressbar"
            aria-valuenow={Math.round(loyalty.progress * 100)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Progress to ${loyalty.nextTier ?? "max tier"}`}
            className="h-2.5 min-w-48 flex-1 overflow-hidden rounded-full"
            style={{ background: "var(--line)", maxWidth: 320 }}
          >
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${Math.max(loyalty.progress * 100, 6)}%`,
                background: "linear-gradient(90deg, var(--gold), var(--accent))",
              }}
            />
          </div>
        </div>
      </section>

      {/* ACTIVE */}
      {active.length > 0 && (
        <section className="mb-12" aria-label="Active stays">
          <h2 className="font-display mb-4 text-xl font-semibold">Happening now</h2>
          <div className="space-y-4">
            {active.map((b) => (
              <article key={b.id} className="card overflow-hidden p-0">
                <div className="grid grid-cols-1 sm:grid-cols-[180px_1fr]">
                  <HotelArt seed={b.roomType.hotel.artSeed} className="h-32 w-full sm:h-full" />
                  <div className="p-5 sm:p-6">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="eyebrow">{statusLabel(b.status)} · Room {b.roomNumber ?? "?"}</p>
                        <h3 className="font-display mt-1 text-xl font-semibold">
                          {b.roomType.hotel.name}, {b.roomType.hotel.city}
                        </h3>
                      </div>
                      <span
                        className="flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold"
                        style={{ background: "color-mix(in srgb, var(--pine) 13%, transparent)", color: "var(--pine)" }}
                      >
                        <span aria-hidden className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />
                        Key active
                      </span>
                    </div>
                    <p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>
                      {b.roomType.name} · until {formatDate(b.checkOut)}
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Link href={`/trips/${b.code}`} className="btn-primary !py-2.5">My Aurelia Stay</Link>
                      <Link href={`/trips/${b.code}/in-stay`} className="btn-secondary !py-2.5">In-stay hub</Link>
                      <Link href={`/trips/${b.code}/checkout`} className="btn-secondary !py-2.5">Checkout</Link>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {/* UPCOMING */}
      {upcoming.length > 0 && (
        <section className="mb-12" aria-label="Upcoming stays">
          <h2 className="font-display mb-4 text-xl font-semibold">Upcoming</h2>
          <div className="space-y-4">
            {upcoming.map((b) => (
              <article key={b.id} className="card overflow-hidden p-0">
                <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr_auto]">
                  <HotelArt seed={b.roomType.hotel.artSeed} className="h-36 w-full lg:h-full" />
                  <div className="p-5 sm:p-6">
                    <p className="eyebrow">{statusLabel(b.status)}</p>
                    <h3 className="font-display mt-1 text-xl font-semibold">
                      {b.roomType.hotel.name}, {b.roomType.hotel.city}
                    </h3>
                    <p className="mt-1.5 text-sm" style={{ color: "var(--muted)" }}>
                      {formatDate(b.checkIn)} → {formatDate(b.checkOut)} · {b.roomType.name} ·{" "}
                      confirmation {b.code}
                    </p>
                    <p
                      className="mt-3 inline-flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-medium"
                      style={{ background: "color-mix(in srgb, var(--accent) 9%, transparent)", color: "var(--ink)" }}
                    >
                      ☀️ {b.roomType.hotel.weather.tempC}°C · {b.roomType.hotel.weather.condition}
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Link href={`/trips/${b.code}`} className="btn-primary !py-2.5">My Aurelia Stay</Link>
                      <Link href={`/trips/${b.code}/check-in`} className="btn-secondary !py-2.5">
                        Prepare & check in
                      </Link>
                    </div>
                  </div>
                  <div className="border-t border-line p-5 sm:p-6 lg:w-72 lg:border-t-0 lg:border-l">
                    <p className="label">Check-in opens in</p>
                    <Countdown targetISO={`${new Date(b.checkIn).toISOString().slice(0, 10)}T14:00:00`} compact />
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {/* PAST */}
      {past.length > 0 && (
        <section aria-label="Past stays">
          <h2 className="font-display mb-4 text-xl font-semibold">Past</h2>
          <div className="space-y-4">
            {past.map((b) => (
              <article key={b.id} className="card p-5 sm:p-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="eyebrow">{statusLabel(b.status)}</p>
                    <h3 className="font-display mt-1 text-lg font-semibold">
                      {b.roomType.hotel.name}, {b.roomType.hotel.city}
                    </h3>
                    <p className="text-sm" style={{ color: "var(--muted)" }}>
                      {formatDate(b.checkIn)} → {formatDate(b.checkOut)} · total{" "}
                      {b.totalInr ? formatINR(b.totalInr) : usdMoneyText(b.total, inr)}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {b.review ? (
                      <span className="rounded-full border border-line px-4 py-2.5 text-sm" style={{ color: "var(--muted)" }}>
                        ★ Reviewed
                      </span>
                    ) : (
                      <Link href={`/trips/${b.code}/feedback`} className="btn-primary !py-2.5">
                        Leave a review
                      </Link>
                    )}
                    <Link href={`/hotels/${b.roomType.hotel.slug}`} className="btn-secondary !py-2.5">
                      Book again
                    </Link>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
