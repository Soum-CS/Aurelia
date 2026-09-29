"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { addDays, toISODate } from "@/lib/format";
import { LocationAutocomplete, type SelectedPlace } from "./location-autocomplete";

interface SearchBarProps {
  initial?: {
    q?: string;
    place?: string;
    lat?: string;
    lng?: string;
    checkIn?: string;
    checkOut?: string;
    guests?: string;
  };
}

export function SearchBar({ initial }: SearchBarProps) {
  const router = useRouter();
  const [q, setQ] = useState(initial?.q ?? "");
  const [checkIn, setCheckIn] = useState(
    initial?.checkIn ?? toISODate(addDays(new Date(), 7))
  );
  const [checkOut, setCheckOut] = useState(
    initial?.checkOut ?? toISODate(addDays(new Date(), 10))
  );
  const [guests, setGuests] = useState(initial?.guests ?? "2");
  // the authoritative picked place (current location or suggestion);
  // null ⇒ free-typed text search
  const selected = useRef<SelectedPlace | null>(
    initial?.place && initial.lat && initial.lng
      ? { label: initial.place, latitude: Number(initial.lat), longitude: Number(initial.lng) }
      : null
  );

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();

    if (selected.current) {
      // A concrete place was chosen (current location or a suggestion):
      // search near its real coordinates — nearest-first results and map
      // centering follow from there. No hardcoded city anywhere.
      const place = selected.current;
      if (place.latitude !== undefined && place.longitude !== undefined) {
        params.set("place", place.label);
        params.set("lat", String(place.latitude));
        params.set("lng", String(place.longitude));
      } else {
        params.set("q", place.label);
      }
    } else if (q.trim()) {
      // Free-typed text without picking a suggestion → name/city/country query.
      params.set("q", q.trim());
    }

    params.set("checkIn", checkIn);
    params.set("checkOut", checkOut);
    params.set("guests", guests);
    router.push(`/?${params.toString()}#stays`);
  }

  return (
    <form
      onSubmit={submit}
      role="search"
      aria-label="Search stays"
      className="card grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 lg:grid-cols-[1.3fr_1fr_1fr_0.7fr_auto] lg:items-end lg:gap-3 lg:rounded-full lg:px-6"
    >
      <LocationAutocomplete
        value={q}
        onValueChange={setQ}
        onSelect={(place) => {
          selected.current = place;
          if (place && place.latitude !== undefined && place.longitude !== undefined) {
            const params = new URLSearchParams();
            params.set("place", place.label);
            params.set("lat", String(place.latitude));
            params.set("lng", String(place.longitude));
            params.set("checkIn", checkIn);
            params.set("checkOut", checkOut);
            params.set("guests", guests);
            router.push(`/?${params.toString()}#stays`);
          }
        }}
      />
      <div>
        <label htmlFor="in" className="label">
          Check-in
        </label>
        <input
          id="in"
          type="date"
          className="input"
          min={toISODate(new Date())}
          value={checkIn}
          onChange={(e) => {
            setCheckIn(e.target.value);
            if (e.target.value >= checkOut)
              setCheckOut(toISODate(addDays(new Date(e.target.value), 3)));
          }}
        />
      </div>
      <div>
        <label htmlFor="out" className="label">
          Check-out
        </label>
        <input
          id="out"
          type="date"
          className="input"
          min={toISODate(new Date(checkIn))}
          value={checkOut}
          onChange={(e) => setCheckOut(e.target.value)}
        />
      </div>
      <div>
        <label htmlFor="guests" className="label">
          Guests
        </label>
        <select
          id="guests"
          className="input appearance-none"
          value={guests}
          onChange={(e) => setGuests(e.target.value)}
        >
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </div>
      <button type="submit" className="btn-primary h-12 whitespace-nowrap">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
          <circle cx="11" cy="11" r="7" />
          <path d="m21 21-4.3-4.3" />
        </svg>
        Search
      </button>
    </form>
  );
}
