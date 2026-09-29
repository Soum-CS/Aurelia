"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { formatINR } from "@/lib/format";

interface Experience {
  id: string;
  name: string;
  category: string;
  description: string;
  distanceKm: number;
  durationHours: number | null;
  priceInr: number | null;
  rating: number | null;
  meetingPoint: string | null;
  available: boolean;
  emoji: string;
}
interface ExpBooking {
  id: string;
  code: string;
  status: string;
  guests: number;
  priceInr: number;
  when: string | null;
  createdAt: string;
  experience: Experience;
}
interface ItinItem {
  time: string;
  emoji: string;
  title: string;
  detail?: string;
}
interface StayDay {
  date: string;
  label: string;
  items: ItinItem[];
}

const CATEGORY_LABELS: Record<string, string> = {
  attractions: "Attractions",
  museums: "Museums",
  beaches: "Beaches",
  shopping: "Shopping",
  restaurants: "Restaurants",
  cafes: "Cafés",
  activities: "Activities",
  events: "Events",
  tours: "Tours",
  transportation: "Transportation",
};

export function ExperiencesPanel({
  bookingCode,
  checkInISO,
  checkOutISO,
}: {
  bookingCode: string;
  checkInISO: string;
  checkOutISO: string;
}) {
  const router = useRouter();
  const [data, setData] = useState<{ hotel: { name: string; city: string }; experiences: Experience[]; myBookings: ExpBooking[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [whenPick, setWhenPick] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [days, setDays] = useState<StayDay[] | null>(null);
  const [genState, setGenState] = useState<"idle" | "generating" | "done">("idle");

  const loadItinerary = useCallback(async () => {
    try {
      const res = await fetch(`/api/bookings/${bookingCode}/itinerary`, { cache: "no-store" });
      if (res.ok) {
        const d = await res.json();
        if (Array.isArray(d.days) && d.days.length) {
          setDays(d.days);
          setGenState("done");
        }
      }
    } catch {
      /* no itinerary yet */
    }
  }, [bookingCode]);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/bookings/${bookingCode}/experiences`, { cache: "no-store" });
      const d = await res.json();
      if (!res.ok) {
        setError(d.message ?? d.error ?? "Experiences are temporarily unavailable.");
        return;
      }
      setData(d);
    } catch {
      setError("Local experiences are temporarily unavailable. Please try again later.");
    }
  }, [bookingCode]);

  useEffect(() => {
    void (async () => {
      await load();
      await loadItinerary();
    })();
  }, [load, loadItinerary]);

  async function addToStay(exp: Experience) {
    if (busyId || !exp.available) return;
    setBusyId(exp.id);
    setNotice(null);
    try {
      const res = await fetch(`/api/bookings/${bookingCode}/experiences`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          experienceId: exp.id,
          when: whenPick[exp.id] || undefined,
          guests: 2,
        }),
      });
      const d = await res.json();
      if (res.ok) {
        setNotice(`Added “${exp.name}” to your stay.`);
        await load();
        router.refresh();
      } else {
        setNotice(d.error ?? "Could not add this experience right now.");
      }
    } finally {
      setBusyId(null);
      setTimeout(() => setNotice(null), 5000);
    }
  }

  async function cancel(id: string) {
    if (busyId) return;
    setBusyId(id);
    try {
      await fetch(`/api/bookings/${bookingCode}/experiences?id=${id}`, { method: "DELETE" });
      await load();
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  async function generate() {
    if (genState === "generating") return;
    setGenState("generating");
    try {
      const res = await fetch(`/api/bookings/${bookingCode}/itinerary`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const d = await res.json();
      if (res.ok && Array.isArray(d.days)) {
        setDays(d.days);
        setGenState("done");
      } else {
        setNotice(d.error ?? "Could not generate your itinerary.");
        setGenState("idle");
      }
    } catch {
      setNotice("Could not generate your itinerary right now.");
      setGenState("idle");
    }
  }

  if (error) {
    return (
      <div className="card p-8 text-center">
        <p className="text-3xl" aria-hidden>🧭</p>
        <h2 className="font-display mt-3 text-xl font-semibold">Explore nearby</h2>
        <p className="mx-auto mt-2 max-w-sm text-sm" style={{ color: "var(--muted)" }}>{error}</p>
        <button type="button" className="btn-secondary mt-5" onClick={() => location.reload()}>TRY AGAIN</button>
      </div>
    );
  }
  if (!data) {
    return <div className="card animate-pulse p-8 text-center text-sm" style={{ color: "var(--muted)" }}>Loading nearby…</div>;
  }

  const categories = [...new Set(data.experiences.map((e) => e.category))];

  return (
    <div className="space-y-6">
      {notice && (
        <p role="status" aria-live="polite" className="card border-accent p-3 text-xs font-medium" style={{ color: "var(--pine)" }}>
          {notice}
        </p>
      )}

      {/* AI itinerary */}
      <section id="itinerary" aria-label="AI itinerary" className="card p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-semibold">My AI itinerary</h2>
            <p className="mt-0.5 text-xs" style={{ color: "var(--muted)" }}>
              Built from your stay dates, {data.hotel.name}&apos;s neighbourhood picks and real experience listings.
            </p>
          </div>
          <button type="button" className={days ? "btn-secondary" : "btn-primary"} onClick={generate} disabled={genState === "generating"}>
            {genState === "generating" ? "Planning…" : days ? "REGENERATE" : "GENERATE MY ITINERARY"}
          </button>
        </div>

        {days && (
          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            {days.map((day) => (
              <div key={day.date} className="rounded-2xl border border-line p-4">
                <h3 className="text-sm font-bold tracking-wide uppercase">Day · {day.label}</h3>
                <ul className="mt-3 space-y-2.5">
                  {day.items.map((it, i) => (
                    <li key={i} className="flex gap-3 text-sm">
                      <span aria-hidden>{it.emoji}</span>
                      <span>
                        <strong>{it.time}</strong> — {it.title}
                        {it.detail && (
                          <span className="block text-xs" style={{ color: "var(--muted)" }}>{it.detail}</span>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* my planned experiences */}
      {data.myBookings.filter((b) => b.status !== "CANCELLED").length > 0 && (
        <section aria-label="Added to my stay" className="card p-5 sm:p-6">
          <h2 className="font-display text-lg font-semibold">On my stay</h2>
          <ul className="mt-3 space-y-2">
            {data.myBookings.filter((b) => b.status !== "CANCELLED").map((b) => (
              <li key={b.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line px-4 py-3 text-sm">
                <span>
                  <strong>{b.experience.emoji} {b.experience.name}</strong>{" "}
                  <span style={{ color: "var(--muted)" }}>
                    · {b.guests} guest{b.guests > 1 ? "s" : ""}
                    {b.when ? ` · ${new Date(b.when).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}` : " · pick a time anytime"}
                  </span>
                </span>
                <span className="flex items-center gap-3">
                  {b.priceInr > 0 && <strong>{formatINR(b.priceInr)}</strong>}
                  <button
                    type="button"
                    className="cursor-pointer text-xs underline"
                    style={{ color: "#b03a2e" }}
                    disabled={Boolean(busyId)}
                    onClick={() => cancel(b.id)}
                  >
                    Cancel
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* catalog */}
      <section aria-label="Nearby experiences">
        <h2 className="font-display mb-3 text-lg font-semibold">Explore nearby · {data.hotel.city}</h2>
        {categories.map((cat) => (
          <div key={cat} className="mb-6">
            <h3 className="mb-2 text-xs font-bold tracking-widest uppercase" style={{ color: "var(--muted)" }}>
              {CATEGORY_LABELS[cat] ?? cat}
            </h3>
            <ul className="grid gap-3 sm:grid-cols-2">
              {data.experiences.filter((e) => e.category === cat).map((e) => (
                <li key={e.id} className={`card p-4 ${!e.available ? "opacity-60" : ""}`}>
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="text-sm font-semibold">{e.emoji} {e.name}</h4>
                    {e.rating != null && (
                      <span className="shrink-0 text-xs font-semibold" style={{ color: "var(--accent)" }}>★ {e.rating.toFixed(1)}</span>
                    )}
                  </div>
                  <p className="mt-1 text-xs leading-relaxed" style={{ color: "var(--muted)" }}>{e.description}</p>
                  <p className="mt-1.5 flex flex-wrap gap-x-3 text-[11px]" style={{ color: "var(--muted)" }}>
                    <span>📍 {e.distanceKm.toFixed(1)} km away</span>
                    {e.durationHours != null && <span>🕒 {e.durationHours} h</span>}
                    <span>{e.priceInr != null && e.priceInr > 0 ? `💰 ${formatINR(e.priceInr)} / guest` : "🆓 Free"}</span>
                  </p>
                  {e.meetingPoint && (
                    <p className="mt-0.5 text-[11px]" style={{ color: "var(--muted)" }}>Meet: {e.meetingPoint}</p>
                  )}
                  {e.available ? (
                    <div className="mt-2.5 flex flex-wrap items-center gap-2">
                      <input
                        type="datetime-local"
                        aria-label={`When for ${e.name}`}
                        className="input !w-auto !py-1.5 text-xs"
                        min={`${checkInISO.slice(0, 10)}T08:00`}
                        max={`${checkOutISO.slice(0, 10)}T22:00`}
                        value={whenPick[e.id] ?? ""}
                        onChange={(ev) => setWhenPick((w) => ({ ...w, [e.id]: ev.target.value }))}
                      />
                      <button
                        type="button"
                        className="btn-primary !px-4 !py-1.5 !text-xs"
                        disabled={Boolean(busyId)}
                        onClick={() => addToStay(e)}
                      >
                        {busyId === e.id ? "Adding…" : "ADD TO MY STAY"}
                      </button>
                    </div>
                  ) : (
                    <p className="mt-2 text-[11px] font-semibold" style={{ color: "#b03a2e" }}>
                      Not accepting bookings right now
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>
    </div>
  );
}
