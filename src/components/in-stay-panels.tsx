"use client";

import { useState } from "react";
import { HOUSEKEEPING_REQUESTS, ROOM_SERVICE_MENU } from "@/lib/constants";
import { usdMoneyText } from "@/lib/currency";

export function RoomServiceOrderer({
  rateInfo,
  bookingCode,
  onOrdered,
}: {
  rateInfo: { rate: number; live: boolean };
  bookingCode: string;
  onOrdered?: () => void;
}) {
  const [section, setSection] = useState(ROOM_SERVICE_MENU[0].section);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [lastOrder, setLastOrder] = useState<string | null>(null);

  async function order(itemId: string, name: string) {
    setBusyId(itemId);
    try {
      const res = await fetch(`/api/bookings/${bookingCode}/services`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "ROOM_SERVICE", itemId }),
      });
      if (res.ok) {
        setLastOrder(`${name} — kitchen has it. ETA ~25 min.`);
        onOrdered?.();
      }
    } finally {
      setBusyId(null);
    }
  }

  const sections = [...new Set(ROOM_SERVICE_MENU.map((m) => m.section))];

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-1.5" role="tablist" aria-label="Menu sections">
        {sections.map((s) => (
          <button
            key={s}
            type="button"
            role="tab"
            aria-selected={section === s}
            onClick={() => setSection(s)}
            className={`cursor-pointer rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
              section === s ? "" : "hover:bg-raised"
            }`}
            style={
              section === s
                ? { background: "var(--accent)", color: "var(--on-accent)", borderColor: "transparent" }
                : { borderColor: "var(--line)" }
            }
          >
            {s}
          </button>
        ))}
      </div>
      <ul className="space-y-2">
        {ROOM_SERVICE_MENU.filter((m) => m.section === section).map((item) => (
          <li key={item.id}>
            <button
              type="button"
              onClick={() => order(item.id, item.name)}
              disabled={busyId === item.id}
              className="group focus-visible:outline-accent flex w-full cursor-pointer items-center justify-between gap-3 rounded-xl border border-line px-4 py-3 text-left transition-colors hover:bg-raised focus-visible:outline-2 disabled:opacity-60"
            >
              <span>
                <span className="block text-sm font-semibold">{item.name}</span>
                <span className="text-xs" style={{ color: "var(--muted)" }}>
                  {item.description}
                </span>
              </span>
              <span className="shrink-0 text-sm font-semibold">
                {busyId === item.id ? (
                  <span aria-hidden className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent align-middle opacity-70" />
                ) : (
                  usdMoneyText(item.price, rateInfo)
                )}
              </span>
            </button>
          </li>
        ))}
      </ul>
      <p role="status" aria-live="polite" className="mt-3 min-h-5 text-xs font-medium" style={{ color: "var(--pine)" }}>
        {lastOrder ?? ""}
      </p>
    </div>
  );
}

export function HousekeepingButtons({ bookingCode }: { bookingCode: string }) {
  const [done, setDone] = useState<string | null>(null);

  async function request(id: string, label: string, detail: string) {
    await fetch(`/api/bookings/${bookingCode}/services`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "HOUSEKEEPING", title: label, detail }),
    });
    setDone(label);
    setTimeout(() => setDone(null), 2500);
  }

  return (
    <div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {HOUSEKEEPING_REQUESTS.map((r) => (
          <button
            key={r.id}
            type="button"
            onClick={() => request(r.id, r.label, r.detail)}
            className="focus-visible:outline-accent cursor-pointer rounded-xl border border-line px-4 py-3 text-left transition-colors hover:bg-raised focus-visible:outline-2"
          >
            <span className="block text-sm font-semibold">{r.label}</span>
            <span className="text-xs" style={{ color: "var(--muted)" }}>
              {r.detail}
            </span>
          </button>
        ))}
      </div>
      <p role="status" aria-live="polite" className="mt-3 min-h-5 text-xs font-medium" style={{ color: "var(--pine)" }}>
        {done ? `“${done}” requested — team notified.` : ""}
      </p>
    </div>
  );
}

export function IssueReportForm({ bookingCode }: { bookingCode: string }) {
  const [detail, setDetail] = useState("");
  const [severity, setSeverity] = useState<"minor" | "major">("minor");
  const [photoName, setPhotoName] = useState<string | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [routing, setRouting] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  function pickPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoName(file.name);
    const reader = new FileReader();
    reader.onload = () => setPhotoUrl(String(reader.result));
    reader.readAsDataURL(file);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!detail.trim() || sending) return;
    setSending(true);
    try {
      const res = await fetch(`/api/bookings/${bookingCode}/services`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "ISSUE", detail, severity, photoUrl }),
      });
      const data = await res.json();
      if (res.ok) {
        setRouting(data.routing);
        setDetail("");
        setPhotoName(null);
        setPhotoUrl(null);
        setSeverity("minor");
      }
    } finally {
      setSending(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div>
        <label htmlFor="issue-detail" className="label">What&apos;s wrong?</label>
        <textarea
          id="issue-detail"
          className="input min-h-20 resize-y"
          placeholder="e.g. AC blowing warm air since last night"
          value={detail}
          onChange={(e) => setDetail(e.target.value)}
          maxLength={500}
        />
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <fieldset className="flex items-center gap-2">
          <legend className="sr-only">Severity</legend>
          {(["minor", "major"] as const).map((s) => (
            <label
              key={s}
              className="cursor-pointer rounded-full border px-3 py-1.5 text-xs font-semibold capitalize"
              style={
                severity === s
                  ? {
                      background: s === "major" ? "#b03a2e" : "var(--pine)",
                      color: "white",
                      borderColor: "transparent",
                    }
                  : { borderColor: "var(--line)" }
              }
            >
              <input
                type="radio"
                name="severity"
                value={s}
                checked={severity === s}
                onChange={() => setSeverity(s)}
                className="sr-only"
              />
              {s === "major" ? "Urgent" : "Minor"}
            </label>
          ))}
        </fieldset>

        <label className="btn-secondary !px-4 !py-2 !text-xs">
          {photoName ? `📷 ${photoName.slice(0, 22)}` : "Attach photo"}
          <input type="file" accept="image/*" onChange={pickPhoto} className="sr-only" />
        </label>
      </div>

      <button type="submit" className="btn-primary w-full !py-2.5" disabled={!detail.trim() || sending}>
        {sending ? "Sending…" : severity === "major" ? "Report urgent issue" : "Report issue"}
      </button>
      <p role="status" aria-live="polite" className="min-h-5 text-xs font-medium" style={{ color: "var(--pine)" }}>
        {routing ?? ""}
      </p>
    </form>
  );
}
