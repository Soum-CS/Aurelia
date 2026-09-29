"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface ServiceRequest {
  id: string;
  kind: string;
  title: string;
  detail: string | null;
  price: number;
  status: string;
  priority: string;
  createdAt: string;
}

const CATALOG = [
  { emoji: "🧻", title: "Fresh towels", detail: "Two bath, two hand" },
  { emoji: "🛏️", title: "Extra pillow", detail: "Soft, firm or memory foam — say which" },
  { emoji: "🧴", title: "Toiletries", detail: "Shampoo, soap, brush, kit" },
  { emoji: "💧", title: "Drinking water", detail: "Two bottles" },
  { emoji: "🧹", title: "Housekeeping", detail: "Light refresh, ~20 min" },
  { emoji: "🧺", title: "Laundry pickup", detail: "Next cycle is 18:00" },
  { emoji: "🔧", title: "Maintenance", detail: "Something not working right?" },
  { emoji: "⏰", title: "Wake-up call", detail: "Tell us the time in notes" },
  { emoji: "🧳", title: "Luggage assistance", detail: "Bell desk trolley to your door" },
  { emoji: "🛎️", title: "Front desk request", detail: "Anything else at all" },
];

const FLOW = ["OPEN", "ACCEPTED", "IN_PROGRESS", "RESOLVED"] as const;
const FLOW_LABELS: Record<string, string> = {
  OPEN: "Requested",
  ACCEPTED: "Accepted",
  IN_PROGRESS: "In progress",
  RESOLVED: "Completed",
};

export function ServicesPanel({ bookingCode }: { bookingCode: string }) {
  const router = useRouter();
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [busyTitle, setBusyTitle] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [notes, setNotes] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/bookings/${bookingCode}/services`, { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setRequests(data.requests ?? []);
      }
    } catch {
      /* keep previous */
    }
  }, [bookingCode]);

  useEffect(() => {
    void (async () => load())();
  }, [load]);

  async function request(title: string, detail: string) {
    if (busyTitle) return;
    setBusyTitle(title);
    try {
      const res = await fetch(`/api/bookings/${bookingCode}/services`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: /maintenance/i.test(title)
            ? "ISSUE"
            : /laundry|dry.?clean/i.test(`${title} ${detail}`)
              ? "HOUSEKEEPING"
              : "HOUSEKEEPING",
          title,
          detail: detail || undefined,
          priority: /urgent/i.test(notes) ? "URGENT" : undefined,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setToast(`“${title}” requested — team notified. Track it below.`);
        setNotes("");
        await load();
        router.refresh();
      } else {
        setToast(data.error ?? "The request could not be logged. Please try again.");
      }
    } catch {
      setToast("Network problem — nothing was sent.");
    } finally {
      setBusyTitle(null);
      setTimeout(() => setToast(null), 5000);
    }
  }

  return (
    <div className="space-y-6">
      <section aria-label="Service catalog" className="card p-5 sm:p-6">
        <h2 className="font-display text-lg font-semibold">One-tap requests</h2>
        <p className="mb-4 mt-0.5 text-xs" style={{ color: "var(--muted)" }}>
          Delivered by your hotel&apos;s own team. Every request gets a live status.
        </p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {CATALOG.map((c) => (
            <button
              key={c.title}
              type="button"
              disabled={Boolean(busyTitle)}
              onClick={() => request(c.title, c.detail)}
              className="focus-visible:outline-accent cursor-pointer rounded-xl border border-line px-4 py-3 text-left transition-colors hover:bg-raised focus-visible:outline-2 disabled:opacity-60"
            >
              <span className="block text-sm font-semibold">
                <span aria-hidden className="mr-1.5">{c.emoji}</span>
                {busyTitle === c.title ? "Sending…" : c.title}
              </span>
              <span className="text-xs" style={{ color: "var(--muted)" }}>{c.detail}</span>
            </button>
          ))}
        </div>
        <div className="mt-4">
          <label htmlFor="svc-notes" className="label">Add a note to the team (optional)</label>
          <input
            id="svc-notes"
            className="input"
            placeholder="e.g. wake me at 6:30 AM · extra pillows are urgent"
            value={notes}
            maxLength={300}
            onChange={(e) => setNotes(e.target.value)}
          />
          <button
            type="button"
            className="btn-secondary mt-2 !py-2 !text-xs"
            disabled={!notes.trim() || Boolean(busyTitle)}
            onClick={() => request("Custom request", notes.trim())}
          >
            Send custom request
          </button>
        </div>
        <p role="status" aria-live="polite" className="mt-3 min-h-5 text-xs font-medium" style={{ color: "var(--pine)" }}>
          {toast ?? ""}
        </p>
      </section>

      <section aria-label="Your service requests" className="card p-5 sm:p-6">
        <h2 className="font-display text-lg font-semibold">Requests on this stay</h2>
        {requests.length === 0 ? (
          <p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>Nothing yet — tap any card above.</p>
        ) : (
          <ul className="mt-4 space-y-4">
            {requests.map((r) => {
              const idx = FLOW.indexOf(r.status as (typeof FLOW)[number]);
              return (
                <li key={r.id} className="rounded-2xl border border-line p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <strong>{r.title}</strong>
                    <span className="text-xs" style={{ color: "var(--muted)" }}>
                      {new Date(r.createdAt).toLocaleString("en-IN")}
                      {r.priority === "URGENT" && (
                        <span className="ml-2 rounded-full px-2 py-0.5 font-semibold" style={{ background: "#b03a2e22", color: "#b03a2e" }}>
                          Urgent
                        </span>
                      )}
                    </span>
                  </div>
                  {r.detail && (
                    <p className="mt-1 text-xs" style={{ color: "var(--muted)" }}>{r.detail}</p>
                  )}
                  {r.status === "RESOLVED" ? (
                    <p className="mt-2 text-xs font-semibold" style={{ color: "var(--pine)" }}>✓ Completed</p>
                  ) : idx >= 0 ? (
                    <ol className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-semibold tracking-wide">
                      {FLOW.map((s, i) => (
                        <li key={s} className="flex items-center gap-2">
                          <span
                            className={`rounded-full px-2 py-0.5 ${i > idx ? "opacity-45" : ""}`}
                            style={{
                              background: i === idx ? "var(--accent)" : i < idx ? "color-mix(in srgb, var(--pine) 14%, transparent)" : "var(--line)",
                              color: i === idx ? "var(--on-accent)" : i < idx ? "var(--pine)" : "var(--muted)",
                            }}
                          >
                            {i < idx ? "✓ " : ""}{FLOW_LABELS[s]}
                          </span>
                          {i < FLOW.length - 1 && <span aria-hidden className="opacity-40">→</span>}
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <p className="mt-2 text-xs">{r.status.replace("_", " ").toLowerCase()}</p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
