"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ARRIVAL_TIMES, PILLOW_OPTIONS } from "@/lib/constants";

export function CheckInForm({
  bookingCode,
  saved,
}: {
  bookingCode: string;
  saved: Record<string, string>;
}) {
  const router = useRouter();
  const [arrivalTime, setArrivalTime] = useState(saved.arrivalTime ?? ARRIVAL_TIMES[1]);
  const [flightNumber, setFlightNumber] = useState(saved.flightNumber ?? "");
  const [specialRequests, setSpecialRequests] = useState(saved.specialRequests ?? "");
  const [pillow, setPillow] = useState(saved.pillow ?? PILLOW_OPTIONS[0].id);
  const [minibar, setMinibar] = useState(saved.minibar ?? "");
  const [status, setStatus] = useState<string | null>(null);
  const [checkingIn, setCheckingIn] = useState(false);

  async function saveDraft() {
    const res = await fetch(`/api/bookings/${bookingCode}/pre-arrival`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ arrivalTime, flightNumber, specialRequests, pillow, minibar }),
    });
    setStatus(res.ok ? "Preferences saved — see you soon." : "Couldn't save just yet.");
    setTimeout(() => setStatus(null), 2500);
  }

  async function completeCheckIn() {
    setCheckingIn(true);
    try {
      await fetch(`/api/bookings/${bookingCode}/pre-arrival`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ arrivalTime, flightNumber, specialRequests, pillow, minibar }),
      });
      const res = await fetch(`/api/bookings/${bookingCode}/check-in`, { method: "POST" });
      if (res.ok) router.refresh();
    } finally {
      setCheckingIn(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="card space-y-5 p-6 sm:p-8">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="arrival" className="label">Estimated arrival</label>
            <select
              id="arrival"
              className="input appearance-none"
              value={arrivalTime}
              onChange={(e) => setArrivalTime(e.target.value)}
            >
              {ARRIVAL_TIMES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="flight" className="label">Flight number (optional)</label>
            <input
              id="flight"
              className="input"
              placeholder="TP 1353"
              value={flightNumber}
              onChange={(e) => setFlightNumber(e.target.value.toUpperCase())}
            />
            <p className="mt-1.5 text-xs" style={{ color: "var(--muted)" }}>
              We&apos;ll watch for delays and nudge the front desk automatically.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="pillow" className="label">Pillow preference</label>
            <select
              id="pillow"
              className="input appearance-none"
              value={pillow}
              onChange={(e) => setPillow(e.target.value)}
            >
              {PILLOW_OPTIONS.map((p) => (
                <option key={p.id} value={p.id}>{p.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="minibar" className="label">Minibar preferences</label>
            <input
              id="minibar"
              className="input"
              placeholder="e.g. no alcohol, extra sparkling water"
              value={minibar}
              onChange={(e) => setMinibar(e.target.value)}
            />
          </div>
        </div>

        <div>
          <label htmlFor="requests" className="label">Special requests</label>
          <textarea
            id="requests"
            className="input min-h-20 resize-y"
            placeholder="High floor, quiet room away from the elevator, cot for a toddler…"
            value={specialRequests}
            onChange={(e) => setSpecialRequests(e.target.value)}
            maxLength={500}
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
          <button type="button" onClick={saveDraft} className="btn-secondary">
            Save preferences
          </button>
          <button type="button" onClick={completeCheckIn} disabled={checkingIn} className="btn-primary min-w-56">
            {checkingIn ? (
              <>
                <span aria-hidden className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                Issuing key…
              </>
            ) : (
              "Complete digital check-in"
            )}
          </button>
          <p role="status" aria-live="polite" className="w-full text-sm font-medium sm:w-auto sm:flex-1 sm:text-right" style={{ color: "var(--pine)" }}>
            {status ?? ""}
          </p>
        </div>
      </div>
    </div>
  );
}
