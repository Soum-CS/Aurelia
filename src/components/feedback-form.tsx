"use client";

import { useState } from "react";

const CATEGORIES = [
  { key: "cleanliness", label: "Cleanliness" },
  { key: "staff", label: "Staff" },
  { key: "comfort", label: "Comfort" },
  { key: "valueForMoney", label: "Value" },
  { key: "locationScore", label: "Location" },
] as const;

type Ratings = Record<string, number>;

function Stars({
  value,
  onChange,
  label,
}: {
  value: number;
  onChange: (v: number) => void;
  label: string;
}) {
  const [hover, setHover] = useState(0);
  const shown = hover || value;
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm font-medium">{label}</span>
      <div className="flex gap-1" role="radiogroup" aria-label={`Rate ${label}`}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={`${n} star${n > 1 ? "s" : ""}`}
            onMouseEnter={() => setHover(n)}
            onMouseLeave={() => setHover(0)}
            onClick={() => onChange(n)}
            className="focus-visible:outline-accent cursor-pointer rounded p-0.5 transition-transform hover:scale-110 focus-visible:outline-2"
          >
            <svg
              viewBox="0 0 24 24"
              width="22"
              height="22"
              fill={shown >= n ? "#c9a25e" : "none"}
              stroke={shown >= n ? "#c9a25e" : "var(--line)"}
              strokeWidth="1.6"
              aria-hidden
            >
              <path d="M12 2.6l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.5l-5.9 3.1 1.2-6.5L2.5 9.5l6.6-.9 2.9-6Z" />
            </svg>
          </button>
        ))}
      </div>
    </div>
  );
}

export function FeedbackForm({ bookingCode }: { bookingCode: string }) {
  const [ratings, setRatings] = useState<Ratings>({});
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    message: string;
    flagged: boolean;
    score: number;
  } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (CATEGORIES.some((c) => !ratings[c.key])) {
      setError("Rate all five categories, please.");
      return;
    }
    setSending(true);
    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: bookingCode, ...ratings, text }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
        return;
      }
      setResult({
        message: data.message,
        flagged: data.sentiment.flagged,
        score: data.sentiment.score,
      });
    } finally {
      setSending(false);
    }
  }

  if (result) {
    return (
      <div className="card p-8 text-center">
        <span
          aria-hidden
          className="mx-auto flex h-14 w-14 items-center justify-center rounded-full text-2xl"
          style={{
            background: result.flagged
              ? "color-mix(in srgb, #b03a2e 12%, transparent)"
              : "color-mix(in srgb, var(--pine) 14%, transparent)",
          }}
        >
          {result.flagged ? "🛎️" : "✨"}
        </span>
        <h2 className="font-display mt-4 text-2xl font-semibold">Review received</h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed" style={{ color: "var(--muted)" }}>
          {result.message}
        </p>
        <p className="mt-4 inline-block rounded-full border border-line px-4 py-1.5 font-mono text-xs">
          sentiment score {result.score.toFixed(2)} ·{" "}
          {result.flagged ? "flagged for staff follow-up" : "no flags raised"}
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="card space-y-5 p-6 sm:p-8">
      <div className="space-y-3 border-b border-line pb-5">
        {CATEGORIES.map((c) => (
          <Stars
            key={c.key}
            label={c.label}
            value={ratings[c.key] ?? 0}
            onChange={(v) => setRatings((r) => ({ ...r, [c.key]: v }))}
          />
        ))}
      </div>

      <div>
        <label htmlFor="review-text" className="label">Your stay in your words</label>
        <textarea
          id="review-text"
          className="input min-h-28 resize-y"
          placeholder="What stood out — the room, the team, the view? Honest details help future guests."
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={4000}
        />
        <p className="mt-1.5 text-xs" style={{ color: "var(--muted)" }}>
          Reviews are screened for sentiment; strongly negative notes reach a duty manager directly.
        </p>
      </div>

      {error && (
        <p role="alert" className="rounded-xl px-4 py-3 text-sm font-medium" style={{ background: "color-mix(in srgb, #b03a2e 10%, transparent)", color: "#b03a2e" }}>
          {error}
        </p>
      )}

      <button type="submit" className="btn-primary w-full" disabled={sending}>
        {sending ? "Publishing…" : "Publish review"}
      </button>
    </form>
  );
}
