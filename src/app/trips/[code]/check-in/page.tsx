import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getBookingByCode } from "@/lib/data";
import { formatDate, formatDistance } from "@/lib/format";
import { CheckInForm } from "@/components/check-in-form";
import { AmenityIcon } from "@/components/amenity-icon";

interface PageProps {
  params: Promise<{ code: string }>;
}

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return { title: "Digital check-in" };
}

export default async function CheckInPage({ params }: PageProps) {
  const { code } = await params;
  const booking = await getBookingByCode(decodeURIComponent(code));
  if (!booking) notFound();

  const hotel = booking.roomType.hotel;

  return (
    <div className="container-x pt-8 pb-4">
      <nav aria-label="Breadcrumb" className="mb-6 text-sm" style={{ color: "var(--muted)" }}>
        <Link href="/trips" className="hover:text-accent transition-colors">My trips</Link>
        <span aria-hidden className="mx-2">/</span>
        <span style={{ color: "var(--ink)" }}>Check-in · {booking.code}</span>
      </nav>

      {booking.status === "CHECKED_IN" ? (
        <div className="mx-auto max-w-3xl">
          <p className="eyebrow">You&apos;re in ✦</p>
          <h1 className="font-display mt-2 text-3xl font-semibold sm:text-4xl">
            Welcome to {hotel.name}, {booking.guestName.split(" ")[0]}
          </h1>

          {/* key card */}
          <div
            className="animate-fade-up relative mt-8 overflow-hidden rounded-3xl p-7 text-white shadow-2xl sm:p-9"
            style={{
              background:
                "linear-gradient(130deg, #241d13 0%, var(--accent-strong) 55%, #3a2c18 100%)",
            }}
          >
            <div
              aria-hidden
              className="pointer-events-none absolute -top-16 -right-10 h-56 w-56 rounded-full opacity-25 blur-2xl"
              style={{ background: "radial-gradient(closest-side, white, transparent)" }}
            />
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[11px] font-semibold tracking-[0.28em] uppercase opacity-70">
                  Aurelia digital key
                </p>
                <p className="font-display mt-2 text-5xl font-semibold tracking-wide sm:text-6xl">
                  {booking.roomNumber ?? "—"}
                </p>
                <p className="mt-2 text-sm opacity-85">
                  Floor {String(booking.roomNumber ?? "?")[0]} · {booking.roomType.name}
                </p>
              </div>
              <span
                aria-hidden
                className="flex h-12 w-12 items-center justify-center rounded-full border border-white/30 bg-white/10"
              >
                <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                  <rect x="4" y="10" width="16" height="10" rx="2" />
                  <path d="M8 10V7a4 4 0 0 1 7.5-2" />
                </svg>
              </span>
            </div>
            <dl className="mt-8 grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-[11px] tracking-[0.14em] uppercase opacity-60">Guest</dt>
                <dd className="mt-0.5 font-medium">{booking.guestName}</dd>
              </div>
              <div>
                <dt className="text-[11px] tracking-[0.14em] uppercase opacity-60">Until</dt>
                <dd className="mt-0.5 font-medium">{formatDate(booking.checkOut)}</dd>
              </div>
              <div>
                <dt className="text-[11px] tracking-[0.14em] uppercase opacity-60">Status</dt>
                <dd className="mt-0.5 font-medium">Ready · inspected ✓</dd>
              </div>
            </dl>
          </div>

          <div className="card mt-6 p-5 sm:p-6">
            <h2 className="font-display text-lg font-semibold">Finding your room</h2>
            <ol className="mt-3 space-y-2 text-sm" style={{ color: "var(--muted)" }}>
              <li>1. From the lobby, the elevators are past the bar on your right.</li>
              <li>2. Ride to floor {String(booking.roomNumber ?? "?")[0]} — your key unlocks automatically.</li>
              <li>3. Room {booking.roomNumber} is {formatDistance(0.02)} down the hall, on the corner.</li>
            </ol>
            <div className="mt-4 flex flex-wrap gap-2">
              {booking.roomType.accessibilityFeatures.length > 0 &&
                booking.roomType.accessibilityFeatures.map((f: string) => (
                  <span
                    key={f}
                    className="flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs"
                    style={{ borderColor: "var(--line)", color: "var(--pine)" }}
                  >
                    <AmenityIcon name={f} className="h-3.5 w-3.5" />
                    {f}
                  </span>
                ))}
            </div>
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link href={`/trips/${booking.code}/in-stay`} className="btn-primary">
              Open the in-stay hub
            </Link>
            <Link href={`/confirmation/${booking.code}`} className="btn-secondary">
              View e-voucher
            </Link>
          </div>
        </div>
      ) : booking.status === "CHECKED_OUT" ? (
        <div className="mx-auto max-w-xl py-12 text-center">
          <h1 className="font-display text-2xl font-semibold">This stay is already wrapped up</h1>
          <Link href={`/trips/${booking.code}/checkout`} className="btn-primary mt-6">
            View checkout & invoice
          </Link>
        </div>
      ) : (
        <div className="mx-auto max-w-3xl">
          <p className="eyebrow">Pre-arrival</p>
          <h1 className="font-display mt-2 text-3xl font-semibold sm:text-4xl">
            Get ready for {hotel.name}
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-relaxed" style={{ color: "var(--muted)" }}>
            {formatDate(booking.checkIn)} → {formatDate(booking.checkOut)} ·{" "}
            {booking.roomType.name} · confirmation {booking.code}. Tell us when you&apos;re
            coming and how you like things — then skip the front desk entirely.
          </p>

          {/* weather + packing + events */}
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="card p-5">
              <p className="eyebrow !text-[10px]">Weather during your stay</p>
              <p className="font-display mt-1 text-2xl font-semibold">
                {hotel.weather.tempC}°C
              </p>
              <p className="text-sm" style={{ color: "var(--muted)" }}>{hotel.weather.condition}</p>
              <p className="mt-2 text-xs leading-relaxed" style={{ color: "var(--muted)" }}>
                🧳 Packing tip: {hotel.weather.packing}
              </p>
            </div>
            <div className="card p-5">
              <p className="eyebrow !text-[10px]">While you&apos;re in town</p>
              <ul className="mt-1 space-y-1.5 text-xs leading-relaxed" style={{ color: "var(--muted)" }}>
                {hotel.localTips.slice(0, 3).map((tip: string) => (
                  <li key={tip}>📍 {tip}</li>
                ))}
              </ul>
            </div>
          </div>

          {booking.preArrival.flightNumber && (
            <p
              role="status"
              className="mt-5 rounded-xl px-4 py-3 text-sm font-medium"
              style={{
                background: "color-mix(in srgb, var(--accent) 10%, transparent)",
                color: "var(--ink)",
              }}
            >
              ✈️ Watching flight {booking.preArrival.flightNumber} — we&apos;ll flag delays and adjust your arrival automatically.
            </p>
          )}

          <div className="mt-6">
            <CheckInForm bookingCode={booking.code} saved={booking.preArrival} />
          </div>

          <p className="mt-4 text-xs leading-relaxed" style={{ color: "var(--muted)" }}>
            Demo note: check-in simulates ID verification and issues a digital key.
            No documents are uploaded or stored anywhere.
          </p>
        </div>
      )}
    </div>
  );
}
