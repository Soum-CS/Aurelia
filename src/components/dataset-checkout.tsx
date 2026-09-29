"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { formatINR } from "@/lib/format";
import { PaymentFailedCard } from "./payment-failed-card";
import { launchRazorpayCheckout } from "@/lib/razorpay-client";

export interface CheckoutProps {
  hotelId: string;
  hotelName: string;
  cityState: string;
  roomType: string;
  roomsAvailable: number;
  pricePerNightInr: number;
  initialCheckIn: string;
  initialCheckOut: string;
}

type Phase = "form" | "creating" | "checkout" | "verifying" | "failed";

export function DatasetCheckout(p: CheckoutProps) {
  const router = useRouter();
  const [checkIn, setCheckIn] = useState(p.initialCheckIn);
  const [checkOut, setCheckOut] = useState(p.initialCheckOut);
  const [rooms, setRooms] = useState(1);
  const [guests, setGuests] = useState(2);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [phase, setPhase] = useState<Phase>("form");
  const [error, setError] = useState<string | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const nights = useMemo(() => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(checkIn) || !/^\d{4}-\d{2}-\d{2}$/.test(checkOut)) return 0;
    return Math.round((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86_400_000);
  }, [checkIn, checkOut]);
  // display estimate only — the backend re-derives the authoritative amount
  // at order creation and again at signature verification.
  const total = p.pricePerNightInr * Math.max(nights, 0) * rooms;

  function valid() {
    return (
      nights >= 1 && rooms >= 1 && rooms <= p.roomsAvailable &&
      name.trim().length >= 2 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && phone.trim().length >= 8
    );
  }

  async function pay() {
    setError(null);
    setPhase("creating");
    try {
      const res = await fetch("/api/payment/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hotel_id: p.hotelId,
          check_in: checkIn,
          check_out: checkOut,
          rooms,
          guests,
          guest_name: name,
          guest_email: email,
          guest_phone: phone,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? data.error ?? "Could not start payment. No booking has been made.");
        setPhase("failed");
        return;
      }
      setPhase("checkout");
      await launchRazorpayCheckout({
        keyId: data.keyId,
        orderId: data.orderId,
        amountPaise: data.amount,
        currency: data.currency,
        name: "Aurelia",
        description: `${p.hotelName} · ${p.roomType}`,
        isTestSimulation: Boolean(data.isTestSimulation),
        prefill: { name, email, contact: phone },
        themeColor: "#a5763f",
        handler: async (response) => {
          setPhase("verifying");
          try {
            const v = await fetch("/api/payment/verify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(response),
            });
            const vd = await v.json();
            if (v.ok) {
              router.push(`/booking/confirmation/${vd.code}`);
            } else {
              setError(vd.error ?? "Payment verification failed.");
              setPhase("failed");
            }
          } catch {
            setError("Could not reach verification service. Please contact front desk.");
            setPhase("failed");
          }
        },
        onDismiss: () => {
          setError("Payment was cancelled — your booking is not confirmed.");
          setPhase("failed");
        },
        onError: (err) => {
          setError(err.description ?? "Payment failed at the gateway. Please retry.");
          setPhase("failed");
        },
      });
    } catch {
      setError("Network error — no booking has been made. Please try again.");
      setPhase("failed");
    }
  }

  const fmtDate = (iso: string) => (/^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—");

  /* ── payment failure screen ── */
  if (phase === "failed") {
    return (
      <PaymentFailedCard
        message={error}
        onRetry={() => {
          setPhase("form");
          setError(null);
          void pay();
        }}
        onBack={() => {
          setPhase("form");
          setError(null);
        }}
      />
    );
  }

  /* ── processing overlay states ── */
  const busy =
    phase === "creating"
      ? "Preparing secure payment…"
      : phase === "checkout"
        ? "Opening secure checkout…"
        : phase === "verifying"
          ? "Verifying payment…"
          : null;

  const summaryRows: Array<[string, string, boolean?]> = [
    ["Room", `${formatINR(p.pricePerNightInr)} × ${Math.max(nights, 0)} ${nights === 1 ? "night" : "nights"} ${rooms > 1 ? ` × ${rooms} rooms` : ""}`, false],
    ["Taxes & fees", "Included in the displayed room rate", true],
  ];

  return (
    < >
      {/* mobile sticky CTA */}
      <div className="no-print fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 px-5 py-3 backdrop-blur-md lg:hidden">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-display text-lg leading-none font-semibold">{formatINR(total)}</p>
            <p className="mt-0.5 text-[11px]" style={{ color: "var(--muted)" }}>
              {Math.max(nights, 0)} night{nights === 1 ? "" : "s"} · taxes incl.
            </p>
          </div>
          <button type="button" className="btn-primary !px-8" disabled={!valid() || phase !== "form"} onClick={() => void pay()}>
            Pay now
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1.5fr_1fr] lg:pb-0">
        {/* ── LEFT: guest & stay details ── */}
        <section className="card space-y-7 p-6 sm:p-8">
          <div>
            <h2 className="eyebrow">Step 1 · Your stay</h2>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
              <label className="block text-xs font-semibold tracking-wide uppercase" style={{ color: "var(--muted)" }}>Check-in
                <input className="input mt-1" type="date" value={checkIn} min={new Date().toISOString().slice(0, 10)} onChange={(e) => { setCheckIn(e.target.value); if (e.target.value >= checkOut) setCheckOut(e.target.value); }} />
              </label>
              <label className="block text-xs font-semibold tracking-wide uppercase" style={{ color: "var(--muted)" }}>Check-out
                <input className="input mt-1" type="date" value={checkOut} min={checkIn} onChange={(e) => setCheckOut(e.target.value)} />
              </label>
              <label className="block text-xs font-semibold tracking-wide uppercase" style={{ color: "var(--muted)" }}>Guests
                <select className="input mt-1 appearance-none" value={guests} onChange={(e) => setGuests(Number(e.target.value))}>
                  {[1, 2, 3, 4].map((n) => <option key={n}>{n}</option>)}
                </select>
              </label>
            </div>

            <div className="mt-4">
              <label className="block text-xs font-semibold tracking-wide uppercase" style={{ color: "var(--muted)" }}>Rooms (max {p.roomsAvailable})
                <select className="input mt-1 max-w-32 appearance-none" value={rooms} onChange={(e) => setRooms(Number(e.target.value))}>
                  {Array.from({ length: Math.max(1, Math.min(4, p.roomsAvailable)) }, (_, i) => i + 1).map((n) => <option key={n}>{n}</option>)}
                </select>
              </label>
            </div>
          </div>

          <div className="border-t border-line pt-6">
            <h2 className="eyebrow">Step 2 · Guest details</h2>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <input className="input" placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" aria-label="Full name" />
              <input className="input" placeholder="Email — invoice goes here" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" aria-label="Email" />
              <input className="input sm:col-span-2" placeholder="Phone (+91…)" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" aria-label="Phone" />
            </div>
          </div>

          <button type="button" className="btn-primary hidden w-full lg:flex" disabled={!valid() || phase !== "form"} onClick={() => void pay()}>
            {phase === "form" ? `Pay ${formatINR(total)} securely` : busy}
          </button>
          <p className="flex items-center justify-center gap-2 text-xs" style={{ color: "var(--muted)" }}>
            🔒 Secured by Razorpay · card details never touch Aurelia servers
          </p>
        </section>

        {/* ── RIGHT: sticky summary ── */}
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="card overflow-hidden p-0">
            <div className="border-b border-line p-6 pb-4">
              <p className="eyebrow">Your stay</p>
              <h3 className="font-display mt-1 text-xl font-semibold">{p.hotelName}</h3>
              <p className="text-xs" style={{ color: "var(--muted)" }}>{p.cityState}</p>
            </div>

            <dl className="space-y-2.5 p-6 text-sm">
              <div className="flex justify-between"><dt style={{ color: "var(--muted)" }}>Room</dt><dd>{p.roomType}</dd></div>
              <div className="flex justify-between"><dt style={{ color: "var(--muted)" }}>Check-in</dt><dd>{fmtDate(checkIn)}</dd></div>
              <div className="flex justify-between"><dt style={{ color: "var(--muted)" }}>Check-out</dt><dd>{fmtDate(checkOut)}</dd></div>
              <div className="flex justify-between"><dt style={{ color: "var(--muted)" }}>Guests</dt><dd>{guests}</dd></div>
            </dl>

            {/* expandable price breakdown */}
            <div className="border-t border-line px-6 py-4">
              <button
                type="button"
                onClick={() => setDetailsOpen((o) => !o)}
                aria-expanded={detailsOpen}
                className="focus-visible:outline-accent flex w-full cursor-pointer items-center justify-between text-xs font-bold tracking-widest uppercase hover:text-accent transition-colors"
                style={{ color: detailsOpen ? "var(--accent)" : "var(--muted)" }}
              >
                View price details
                <span aria-hidden className={`transition-transform duration-300 ${detailsOpen ? "rotate-180" : ""}`}>⌃</span>
              </button>
              {detailsOpen && (
                <dl className="animate-fade-up mt-3 space-y-2 text-sm">
                  {summaryRows.map(([k, v, muted]) => (
                    <div key={k} className="flex justify-between gap-4">
                      <dt style={{ color: "var(--muted)" }}>{k}</dt>
                      <dd className={muted ? "text-right text-xs" : ""}>{v}</dd>
                    </div>
                  ))}
                  <div className="flex justify-between border-t border-line pt-2 text-xs" style={{ color: "var(--muted)" }}>
                    <dt>Cancellation</dt>
                    <dd className="text-right">Per property policy · see voucher</dd>
                  </div>
                  <p className="pt-1 text-[11px] leading-relaxed" style={{ color: "var(--muted)" }}>
                    The final amount is calculated and charged by our payment backend — never by this page.
                  </p>
                </dl>
              )}
            </div>

            <div className="flex items-baseline justify-between border-t border-line bg-raised p-6">
              <span className="text-sm font-bold tracking-wide uppercase">Total</span>
              <span className="font-display text-2xl font-semibold">{formatINR(total)}</span>
            </div>
          </div>
        </aside>
      </div>

      {/* processing overlay */}
      {busy && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-sm" role="status" aria-live="polite">
          <div className="card mx-6 max-w-sm p-8 text-center">
            <span aria-hidden className="mx-auto mb-4 block h-10 w-10 animate-spin rounded-full border-[3px] border-current border-t-transparent opacity-70" />
            <p className="font-display text-lg font-semibold">Securely processing payment…</p>
            <p className="mt-1.5 text-sm" style={{ color: "var(--muted)" }}>{busy}</p>
          </div>
        </div>
      )}
    </>
  );
}