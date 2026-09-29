"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LocationAutocomplete, type SelectedPlace } from "./location-autocomplete";

function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * The homepage hero search card: destination autocomplete, dates, guests.
 * Submits to the same URL-driven results pipeline as before (?q/place/lat/
 * lng/checkIn/checkOut/guests) — no duplicate search backend.
 */
export function HeroSearch({ initial }: { initial: Record<string, string> }) {
  const router = useRouter();
  const [dest, setDest] = useState(initial.place ?? initial.q ?? "");
  const [picked, setPicked] = useState<SelectedPlace | null>(
    initial.lat && initial.lng
      ? { label: initial.place ?? "Selected location", latitude: Number(initial.lat), longitude: Number(initial.lng) }
      : null,
  );
  const [today] = useState(() => toISODate(new Date()));
  const [checkIn, setCheckIn] = useState(
    () => initial.checkIn ?? toISODate(new Date(Date.now() + 7 * 86_400_000)),
  );
  const [checkOut, setCheckOut] = useState(
    () => initial.checkOut ?? toISODate(new Date(Date.now() + 10 * 86_400_000)),
  );
  const [guests, setGuests] = useState(initial.guests ?? "2");
  const [submitting, setSubmitting] = useState(false);

  function search() {
    if (submitting) return;
    setSubmitting(true);
    const params = new URLSearchParams();
    if (picked) {
      params.set("place", picked.label);
      params.set("lat", String(picked.latitude));
      params.set("lng", String(picked.longitude));
      params.delete("q");
      params.delete("city");
      params.delete("state");
      params.delete("search");
    } else if (dest.trim()) {
      params.set("q", dest.trim());
      params.delete("lat");
      params.delete("lng");
      params.delete("place");
    } else {
      setSubmitting(false);
      return;
    }
    params.set("checkIn", checkIn);
    params.set("checkOut", checkOut);
    params.set("guests", guests);
    router.push(`/?${params.toString()}#stays`);
    // keep the button responsive even before navigation completes
    setTimeout(() => setSubmitting(false), 2500);
  }

  return (
    <div
      className="glass animate-fade-up mx-auto mt-10 w-full max-w-3xl rounded-3xl p-5 shadow-[0_32px_80px_-32px_rgb(var(--shadow-color)/0.45)] sm:p-6"
      role="search"
      aria-label="Hotel search"
    >
      <div className="rounded-2xl border border-line bg-surface p-4 sm:p-5">
        {/* destination */}
        <label className="label" htmlFor="hero-dest">
          📍 Where are you going?
        </label>
        <LocationAutocomplete
          value={dest}
          onValueChange={(v) => {
            setDest(v);
            if (picked) setPicked(null);
          }}
          onSelect={(p) => {
            setPicked(p);
            if (p) {
              setDest(p.label);
              if (p.latitude !== undefined && p.longitude !== undefined) {
                const params = new URLSearchParams();
                params.set("place", p.label);
                params.set("lat", String(p.latitude));
                params.set("lng", String(p.longitude));
                params.set("checkIn", checkIn);
                params.set("checkOut", checkOut);
                params.set("guests", guests);
                params.delete("q");
                params.delete("city");
                params.delete("state");
                params.delete("search");
                router.push(`/?${params.toString()}#stays`);
              }
            }
          }}
        />

        {/* dates + guests */}
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <label className="label" htmlFor="hero-checkin">
              📅 Check-in
            </label>
            <input
              id="hero-checkin"
              type="date"
              className="input"
              min={today}
              value={checkIn}
              onChange={(e) => {
                setCheckIn(e.target.value);
                if (e.target.value >= checkOut) {
                  setCheckOut(toISODate(new Date(new Date(e.target.value).getTime() + 86_400_000)));
                }
              }}
            />
          </div>
          <div>
            <label className="label" htmlFor="hero-checkout">
              📅 Check-out
            </label>
            <input
              id="hero-checkout"
              type="date"
              className="input"
              min={checkIn}
              value={checkOut}
              onChange={(e) => setCheckOut(e.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor="hero-guests">
              👥 Guests
            </label>
            <select
              id="hero-guests"
              className="input appearance-none"
              value={guests}
              onChange={(e) => setGuests(e.target.value)}
            >
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <option key={n} value={n}>
                  {n} {n === 1 ? "guest" : "guests"}
                </option>
              ))}
            </select>
          </div>
        </div>

        <button
          type="button"
          className="btn-primary mt-4 w-full !py-4"
          onClick={search}
          disabled={!picked && !dest.trim()}
        >
          {submitting ? "Finding hotels near you…" : "Search hotels"}
        </button>
      </div>

      <p className="mt-3 text-center text-xs" style={{ color: "var(--muted)" }}>
        Real inventory, real prices in ₹ — Aurelia never shows sample hotels.
      </p>
    </div>
  );
}
