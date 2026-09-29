"use client";

import { useCallback, useEffect, useState } from "react";
import { formatINR } from "@/lib/format";

interface Overview {
  overview: Record<string, number>;
  food: {
    confirmed: number; preparing: number; ready: number; onTheWay: number; delivered: number;
    revenueInr: number;
    recent: { id: string; code: string; status: string; totalInr: number; deliveryLocation: string; placedAt: string; guest: string; items: string[] }[];
  };
  services: {
    open: { id: string; title: string; detail?: string | null; priority: string; kind: string; guest: string; code: string; createdAt: string }[];
    accepted: { id: string; title: string; detail?: string | null; guest: string; code: string }[];
    inProgress: { id: string; title: string; detail?: string | null; guest: string; code: string }[];
    resolvedToday: number;
  };
  rooms: { totalUnits: number; occupied: number; byType: { name: string; hotel: string; unitsAvailable: number; bookedAllTime: number }[] };
  recentBookings: { code: string; guest: string; hotel?: string | null; room?: string | null; checkIn: string; checkOut: string; status: string; paymentStatus?: string | null; totalInr?: number | null }[];
}

const FOOD_NEXT: Record<string, string> = {
  CONFIRMED: "PREPARING",
  PREPARING: "READY",
  READY: "ON_THE_WAY",
  ON_THE_WAY: "DELIVERED",
};
const FOOD_LABELS: Record<string, string> = {
  CONFIRMED: "Confirmed", PREPARING: "Preparing", READY: "Ready", ON_THE_WAY: "On the way", DELIVERED: "Delivered", CANCELLED: "Cancelled",
};

export function AdminDashboard() {
  const [tokenInput, setTokenInput] = useState("");
  const [authed, setAuthed] = useState(false);
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (token: string) => {
    setError(null);
    try {
      const res = await fetch("/api/admin/overview", { headers: { "x-admin-token": token }, cache: "no-store" });
      if (!res.ok) {
        const d = await res.json();
        setError(d.message ?? d.error ?? "Access denied.");
        setAuthed(false);
        return;
      }
      const d = (await res.json()) as Overview;
      setData(d);
      setAuthed(true);
      sessionStorage.setItem("aurelia_admin_token", token);
    } catch {
      setError("Could not reach the operations API.");
    }
  }, []);

  useEffect(() => {
    const saved = sessionStorage.getItem("aurelia_admin_token");
    if (saved) void (async () => load(saved))();
  }, [load]);

  async function advanceOrder(id: string, status: string) {
    if (busy) return;
    setBusy(true);
    try {
      await fetch(`/api/admin/orders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-admin-token": sessionStorage.getItem("aurelia_admin_token") ?? "" },
        body: JSON.stringify({ status }),
      });
      await load(sessionStorage.getItem("aurelia_admin_token") ?? "");
    } finally {
      setBusy(false);
    }
  }

  async function advanceService(id: string, status: string) {
    if (busy) return;
    setBusy(true);
    try {
      await fetch(`/api/admin/services/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-admin-token": sessionStorage.getItem("aurelia_admin_token") ?? "" },
        body: JSON.stringify({ status }),
      });
      await load(sessionStorage.getItem("aurelia_admin_token") ?? "");
    } finally {
      setBusy(false);
    }
  }

  if (!authed) {
    return (
      <div className="card mx-auto max-w-md p-6">
        <h2 className="font-display text-lg font-semibold">Staff sign-in</h2>
        {error && (
          <p role="alert" className="mt-2 rounded-lg border px-3 py-2 text-xs font-medium" style={{ borderColor: "#b03a2e55", background: "#b03a2e11", color: "#b03a2e" }}>
            {error}
          </p>
        )}
        {!error && !data && (
          <p className="mt-1 text-xs" style={{ color: "var(--muted)" }}>
            Hotel operations are protected. Set ADMIN_TOKEN in .env.local to enable staff access —
            without it this dashboard stays locked and no data is exposed.
          </p>
        )}
        <form
          className="mt-4 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            load(tokenInput.trim());
          }}
        >
          <input
            type="password"
            aria-label="Admin token"
            placeholder="ADMIN_TOKEN"
            className="input flex-1"
            value={tokenInput}
            onChange={(e) => setTokenInput(e.target.value)}
          />
          <button type="submit" className="btn-primary">Sign in</button>
        </form>
      </div>
    );
  }

  if (!data) return null;

  const o = data.overview;
  return (
    <div className="space-y-6">
      {/* KPIs */}
      <section aria-label="Hotel overview" className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {[
          ["Bookings", String(o.bookings)],
          ["Active guests", String(o.activeGuests)],
          ["Rooms occupied", `${o.occupiedRooms}/${data.rooms.totalUnits}`],
          ["Food orders", String(data.food.confirmed + data.food.preparing + data.food.ready + data.food.onTheWay)],
          ["Pending requests", String(o.pendingServiceRequests)],
          ["Room revenue", formatINR(o.revenueRoomInrApprox)],
        ].map(([k, v]) => (
          <div key={k} className="card p-4">
            <p className="text-[11px] font-bold tracking-widest uppercase" style={{ color: "var(--muted)" }}>{k}</p>
            <p className="font-display mt-1 text-xl font-semibold">{v}</p>
          </div>
        ))}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* live food board */}
        <section aria-label="Kitchen board" className="card p-5 sm:p-6">
          <h2 className="font-display text-lg font-semibold">Kitchen board</h2>
          <p className="mb-3 mt-0.5 text-xs" style={{ color: "var(--muted)" }}>
            {data.food.preparing} preparing · {data.food.ready} ready · {data.food.onTheWay} on the way · revenue {formatINR(data.food.revenueInr)}
          </p>
          <ul className="divide-y divide-line">
            {data.food.recent.map((ord) => (
              <li key={ord.code} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                <span className="min-w-0">
                  <strong>{ord.code}</strong> · {ord.guest}
                  <span className="block truncate text-[11px]" style={{ color: "var(--muted)" }}>
                    {ord.items.join(", ")} → {ord.deliveryLocation}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <strong>{formatINR(ord.totalInr)}</strong>
                  {FOOD_NEXT[ord.status] ? (
                    <button
                      type="button"
                      className="btn-secondary !px-3 !py-1 !text-[11px]"
                      disabled={busy}
                      onClick={() => advanceOrder(ord.id, FOOD_NEXT[ord.status])}
                    >
                      {ord.status.replace("_", " ")} → {FOOD_LABELS[FOOD_NEXT[ord.status]]}
                    </button>
                  ) : (
                    <span className="rounded-full bg-raised px-2 py-0.5 text-[10px] font-bold uppercase">{FOOD_LABELS[ord.status]}</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </section>

        {/* services queue */}
        <section aria-label="Service requests" className="card p-5 sm:p-6">
          <h2 className="font-display text-lg font-semibold">Service requests</h2>
          <p className="mb-3 mt-0.5 text-xs" style={{ color: "var(--muted)" }}>
            {data.services.open.length} pending · {data.services.accepted.length} accepted · {data.services.inProgress.length} in progress · {data.services.resolvedToday} completed
          </p>
          <ul className="divide-y divide-line">
            {[
              ...data.services.open.map((r) => ({ ...r, next: "ACCEPTED", label: "Accept" })),
              ...data.services.accepted.map((r) => ({ ...r, next: "IN_PROGRESS", label: "Start" })),
              ...data.services.inProgress.map((r) => ({ ...r, next: "RESOLVED", label: "Complete" })),
            ].map((r) => (
              <li key={`${r.next}-${r.id}`} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                <span className="min-w-0">
                  <strong>{r.title}</strong>
                  {"priority" in r && r.priority === "URGENT" && (
                    <span className="ml-2 rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: "#b03a2e18", color: "#b03a2e" }}>URGENT</span>
                  )}
                  <span className="block text-[11px]" style={{ color: "var(--muted)" }}>{r.guest} · {r.code}{r.detail ? ` · ${r.detail}` : ""}</span>
                </span>
                <button
                  type="button"
                  className="btn-secondary shrink-0 !px-3 !py-1 !text-[11px]"
                  disabled={busy}
                  onClick={() => advanceService(r.id, r.next)}
                >
                  {r.label}
                </button>
              </li>
            ))}
          </ul>
        </section>

        {/* rooms */}
        <section aria-label="Rooms" className="card p-5 sm:p-6">
          <h2 className="font-display text-lg font-semibold">Rooms</h2>
          <p className="mb-3 mt-0.5 text-xs" style={{ color: "var(--muted)" }}>
            {data.rooms.occupied} occupied of {data.rooms.totalUnits} units
          </p>
          <ul className="max-h-64 space-y-1.5 overflow-y-auto text-sm">
            {data.rooms.byType.map((r) => (
              <li key={`${r.hotel}-${r.name}`} className="flex justify-between rounded-lg border border-line px-3 py-2">
                <span>{r.name}<span style={{ color: "var(--muted)" }}> · {r.hotel}</span></span>
                <span style={{ color: r.unitsAvailable > 0 ? "var(--pine)" : "#b03a2e" }}>
                  {r.unitsAvailable} free · {r.bookedAllTime} booked all-time
                </span>
              </li>
            ))}
          </ul>
        </section>

        {/* bookings */}
        <section aria-label="Recent bookings" className="card p-5 sm:p-6">
          <h2 className="font-display text-lg font-semibold">Recent bookings</h2>
          <ul className="max-h-72 space-y-1.5 overflow-y-auto text-sm">
            {data.recentBookings.map((b) => (
              <li key={b.code} className="rounded-lg border border-line px-3 py-2">
                <div className="flex justify-between gap-2">
                  <strong>{b.code} · {b.guest}</strong>
                  <span className="shrink-0">{b.totalInr != null ? formatINR(b.totalInr) : ""}</span>
                </div>
                <p className="text-[11px]" style={{ color: "var(--muted)" }}>
                  {b.hotel} · {b.room} · {new Date(b.checkIn).toLocaleDateString("en-IN")} → {new Date(b.checkOut).toLocaleDateString("en-IN")} · {b.status.toLowerCase()} / {(b.paymentStatus ?? "").toLowerCase()}
                </p>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
