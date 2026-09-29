"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { formatINR } from "@/lib/format";

export interface RoomSpec {
  id: string;
  name: string;
  hotelName: string;
  city: string;
  priceInr: number; // nightly, INR snapshot
  sizeSqm: number;
  capacity: number;
  bedType: string;
  view: string;
  amenities: string[];
}

const FEATURES = [
  ["Size", (r: RoomSpec) => `${r.sizeSqm} m²`],
  ["Sleeps", (r: RoomSpec) => String(r.capacity)],
  ["Bed", (r: RoomSpec) => r.bedType],
  ["View", (r: RoomSpec) => r.view],
  ["3D twin", () => "✓"],
] as const;

export function RoomTools({ rooms }: { rooms: RoomSpec[] }) {
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [budget, setBudget] = useState<number | null>(null);
  const [guests, setGuests] = useState(2);
  const [wantBalcony, setWantBalcony] = useState(false);
  const [viewPref, setViewPref] = useState("");
  const [bedPref, setBedPref] = useState("");
  const [profileSynced, setProfileSynced] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/preferences");
        if (res.ok) {
          const d = await res.json();
          const p = d.preferences;
          if (p && Object.keys(p).length > 0) {
            if (p.budgetPerNightInr) setBudget(p.budgetPerNightInr);
            if (Array.isArray(p.roomPrefs)) {
              if (p.roomPrefs.some((x: string) => x.includes("balcony"))) setWantBalcony(true);
              const v = p.roomPrefs.find((x: string) => x.includes("ocean") || x.includes("city"));
              if (v) setViewPref(v.includes("ocean") ? "ocean" : "city");
            }
            if (p.bedPreference) setBedPref(p.bedPreference);
            setProfileSynced(true);
          }
        }
      } catch {
        // silent fallback
      }
    })();
  }, []);

  function toggleCompare(id: string) {
    setCompareIds((ids) =>
      ids.includes(id) ? ids.filter((i) => i !== id) : ids.length >= 3 ? [...ids.slice(1), id] : [...ids, id],
    );
  }

  const compared = rooms.filter((r) => compareIds.includes(r.id));

  const recommendation = useMemo(() => {
    if (budget == null && !wantBalcony && !viewPref && !bedPref) return null;
    const scored = rooms
      .map((r) => {
        const reasons: string[] = [];
        let score = 0;
        let ok = true;

        if (budget != null) {
          if (r.priceInr > budget * 1.15) ok = false;
          else if (r.priceInr <= budget) {
            score += 3;
            reasons.push(`fits your ${formatINR(budget)} budget at ${formatINR(r.priceInr)}/night`);
          } else {
            score += 1;
            reasons.push(`slightly over budget at ${formatINR(r.priceInr)}/night`);
          }
        }
        if (guests > r.capacity) ok = false;
        else {
          score += r.capacity >= guests ? 2 : 0;
          reasons.push(`sleeps ${r.capacity}`);
        }
        if (wantBalcony) {
          const has = r.amenities.some((a) => /balcony|terrace/i.test(a));
          if (!has) ok = false;
          else {
            score += 2;
            reasons.push("includes a balcony");
          }
        }
        if (viewPref) {
          const match = r.view.toLowerCase().includes(viewPref.toLowerCase());
          if (!match) ok = false;
          else {
            score += 2;
            reasons.push(`${viewPref} view`);
          }
        }
        if (bedPref) {
          const match = r.bedType.toLowerCase().includes(bedPref.toLowerCase());
          if (!match) ok = false;
          else {
            score += 1;
            reasons.push(r.bedType);
          }
        }
        // prefer larger rooms when everything else is equal
        score += Math.min(1, r.sizeSqm / 100);
        return { room: r, score, reasons, ok };
      })
      .filter((s) => s.ok)
      .sort((a, b) => b.score - a.score);

    const best = scored[0];
    if (!best) return null;
    return {
      room: best.room,
      why:
        reasonsSentence(best.reasons) +
        (best.room.sizeSqm ? ` It offers ${best.room.sizeSqm} m² of space` : "") +
        ".",
    };
  }, [rooms, budget, guests, wantBalcony, viewPref, bedPref]);

  return (
    <div className="space-y-6">
      {/* AI ROOM RECOMMENDATION */}
      <section aria-label="AI room recommendation" className="card p-5 sm:p-6">
        <h2 className="font-display text-lg font-semibold">What kind of room are you looking for?</h2>
        <div className="mb-4 mt-0.5 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs" style={{ color: "var(--muted)" }}>
            Aurelia recommends from every real room below — and explains why.
          </p>
          {profileSynced && (
            <span className="rounded-full bg-accent/10 border border-accent/20 px-2.5 py-0.5 text-[11px] font-medium text-accent">
              ✨ Filtered by your Aurelia profile
            </span>
          )}
        </div>
        <div className="grid gap-3 sm:grid-cols-5">
          <div>
            <label htmlFor="rt-budget" className="label">Budget / night</label>
            <input
              id="rt-budget"
              type="number"
              min={0}
              step={500}
              placeholder="₹ e.g. 8000"
              className="input"
              value={budget ?? ""}
              onChange={(e) => setBudget(e.target.value ? Number(e.target.value) : null)}
            />
          </div>
          <div>
            <label htmlFor="rt-guests" className="label">Guests</label>
            <input
              id="rt-guests"
              type="number"
              min={1}
              max={6}
              className="input"
              value={guests}
              onChange={(e) => setGuests(Math.max(1, Number(e.target.value) || 1))}
            />
          </div>
          <div>
            <label htmlFor="rt-bed" className="label">Bed preference</label>
            <select id="rt-bed" className="input" value={bedPref} onChange={(e) => setBedPref(e.target.value)}>
              <option value="">Any</option>
              <option value="king">King</option>
              <option value="twin">Twin</option>
              <option value="queen">Queen</option>
              <option value="sofa">Sofa bed option</option>
            </select>
          </div>
          <div>
            <label htmlFor="rt-view" className="label">View</label>
            <select id="rt-view" className="input" value={viewPref} onChange={(e) => setViewPref(e.target.value)}>
              <option value="">Any</option>
              <option value="ocean">Ocean</option>
              <option value="city">City</option>
              <option value="mountain">Mountain</option>
              <option value="garden">Garden</option>
            </select>
          </div>
          <label className="flex cursor-pointer items-end gap-2 pb-2.5 text-sm">
            <input type="checkbox" checked={wantBalcony} onChange={(e) => setWantBalcony(e.target.checked)} />
            Balcony
          </label>
        </div>

        {recommendation && (
          <div role="status" className="mt-4 rounded-2xl border p-4" style={{ borderColor: "color-mix(in srgb, var(--accent) 35%, transparent)", background: "color-mix(in srgb, var(--accent) 7%, transparent)" }}>
            <p className="text-xs font-bold tracking-widest uppercase" style={{ color: "var(--accent)" }}>Recommended · AI pick</p>
            <p className="font-display mt-1 text-lg font-semibold">{recommendation.room.name} · {recommendation.room.hotelName}</p>
            <p className="mt-1 text-sm leading-relaxed" style={{ color: "var(--muted)" }}>
              {recommendation.why}
            </p>
            <Link href={`/rooms/${recommendation.room.id}`} className="btn-primary mt-3 inline-block !py-2 !text-xs">
              View in 3D →
            </Link>
          </div>
        )}
        {recommendation === null && (budget != null || wantBalcony || viewPref || bedPref) && (
          <p role="status" className="mt-4 text-sm" style={{ color: "#b03a2e" }}>
            No room matches all of that right now — try relaxing one constraint.
          </p>
        )}
      </section>

      {/* COMPARE ROOMS */}
      {compared.length >= 2 && (
        <section aria-label="Room comparison" className="card overflow-x-auto p-5 sm:p-6">
          <h2 className="font-display mb-4 text-lg font-semibold">Compare rooms</h2>
          <table className="w-full min-w-96 text-sm">
            <thead>
              <tr>
                <th scope="col" className="pb-2 text-left text-[11px] font-bold tracking-widest uppercase" style={{ color: "var(--muted)" }}>
                  Feature
                </th>
                {compared.map((r) => (
                  <th key={r.id} scope="col" className="pb-2 text-left font-semibold">
                    {r.name}
                    <span className="block text-[11px] font-normal" style={{ color: "var(--muted)" }}>{r.hotelName}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {FEATURES.map(([label, get]) => (
                <tr key={label} className="border-t border-line/60">
                  <th scope="row" className="py-2 pr-4 text-left font-medium" style={{ color: "var(--muted)" }}>{label}</th>
                  {compared.map((r) => (
                    <td key={r.id} className="py-2 pr-4">{get(r)}</td>
                  ))}
                </tr>
              ))}
              <tr className="border-t border-line">
                <th scope="row" className="py-2 pr-4 text-left font-bold uppercase">Rate</th>
                {compared.map((r) => (
                  <td key={r.id} className="py-2 pr-4 font-semibold">{formatINR(r.priceInr)}+</td>
                ))}
              </tr>
              <tr>
                <td />
                {compared.map((r) => (
                  <td key={r.id} className="pt-3">
                    <Link href={`/rooms/${r.id}`} className="btn-secondary !px-3 !py-1.5 !text-[11px]">3D VIEW</Link>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </section>
      )}

      {/* selectable room grid lives around this component */}
      <SelectionContext.Provider value={{ compareIds, toggleCompare }}>
        <RoomGrid rooms={rooms} />
      </SelectionContext.Provider>
    </div>
  );
}

const SelectionContext = createContext<{ compareIds: string[]; toggleCompare: (id: string) => void }>({
  compareIds: [],
  toggleCompare: () => {},
});

function RoomGrid({ rooms }: { rooms: RoomSpec[] }) {
  const { compareIds, toggleCompare } = useContext(SelectionContext);
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {rooms.map((r) => {
        const selected = compareIds.includes(r.id);
        return (
          <li key={r.id}>
            <div className={`card h-full p-5 transition-all ${selected ? "border-accent" : ""}`}>
              <p className="text-[11px] font-bold tracking-widest uppercase" style={{ color: "var(--muted)" }}>
                {r.hotelName} · {r.city}
              </p>
              <h3 className="font-display mt-1 text-lg font-semibold">{r.name}</h3>
              <p className="mt-1 flex items-center justify-between text-sm">
                <span style={{ color: "var(--muted)" }}>{r.sizeSqm} m² · sleeps {r.capacity}</span>
                <span className="font-semibold">{formatINR(r.priceInr)}+</span>
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Link href={`/rooms/${r.id}`} className="btn-secondary !px-3 !py-1.5 !text-[11px]">3D VIEW</Link>
                <button
                  type="button"
                  aria-pressed={selected}
                  onClick={() => toggleCompare(r.id)}
                  className={`cursor-pointer rounded-xl px-3 py-1.5 text-[11px] font-bold transition-colors ${selected ? "" : "btn-secondary"}`}
                  style={selected ? { background: "var(--accent)", color: "var(--on-accent)" } : undefined}
                >
                  {selected ? "✓ COMPARING" : "COMPARE"}
                </button>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function reasonsSentence(reasons: string[]): string {
  if (reasons.length === 0) return "It's the closest overall match to what you asked for.";
  const parts = reasons.slice(0, 3);
  return `It ${parts.join(", ")}.`;
}
