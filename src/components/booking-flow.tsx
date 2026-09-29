"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ADDONS, quotePrice } from "@/lib/pricing";
import { usdMoneyText } from "@/lib/currency";
import { addDays, formatDate, nightsBetween, toISODate } from "@/lib/format";

interface BookingFlowProps {
  rateInfo: { rate: number; live: boolean };
  roomTypeId: string;
  roomName: string;
  hotelName: string;
  city: string;
  basePrice: number;
  capacity: number;
  bedType: string;
  viewLabel: string;
}

const STEPS = ["Stay", "Extras", "Payment"] as const;

export function BookingFlow(props: BookingFlowProps) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [checkIn, setCheckIn] = useState(toISODate(addDays(new Date(), 14)));
  const [checkOut, setCheckOut] = useState(toISODate(addDays(new Date(), 17)));
  const [guests, setGuests] = useState(2);
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [selectedAddons, setSelectedAddons] = useState<string[]>([]);
  const [cardName, setCardName] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvc, setCvc] = useState("");
  const [availResults, setAvailResults] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [rechecking, setRechecking] = useState(false);
  const [priceUpdate, setPriceUpdate] = useState<{ prevUsd: number; nextUsd: number } | null>(null);
  /** Server-confirmed total (USD internal) adopted after a successful recheck. */
  const [confirmedTotalUsd, setConfirmedTotalUsd] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const nights = nightsBetween(checkIn, checkOut);
  const localQuote = useMemo(
    () => quotePrice(props.basePrice, Math.max(nights, 0), guests, selectedAddons),
    [props.basePrice, nights, guests, selectedAddons]
  );
  // Displayed total: the locally-computed quote until the server recheck
  // confirms otherwise (never trust a stale or manipulated number).
  const quote = useMemo(
    () =>
      confirmedTotalUsd != null ? { ...localQuote, total: confirmedTotalUsd } : localQuote,
    [localQuote, confirmedTotalUsd]
  );

  const availKey = `${checkIn}|${checkOut}`;
  const available: number | null | undefined =
    nights > 0 ? availResults[availKey] ?? undefined : null;

  useEffect(() => {
    if (nights <= 0) return;
    let cancelled = false;
    fetch(
      `/api/availability?roomTypeId=${props.roomTypeId}&checkIn=${checkIn}&checkOut=${checkOut}`
    )
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled && typeof d.available === "number") {
          setAvailResults((prev) => ({ ...prev, [`${checkIn}|${checkOut}`]: d.available }));
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [props.roomTypeId, checkIn, checkOut, nights]);

  function toggleAddon(id: string) {
    setSelectedAddons((prev) =>
      prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id]
    );
  }

  function formatCardNumber(v: string) {
    return v.replace(/\D/g, "").slice(0, 16).replace(/(.{4})/g, "$1 ").trim();
  }

  function formatExpiry(v: string) {
    const digits = v.replace(/\D/g, "").slice(0, 4);
    if (digits.length <= 2) return digits;
    return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  }

  function step1Valid() {
    return nights >= 1 && guests >= 1 && guestName.trim().length >= 2 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guestEmail);
  }
  function step3Valid() {
    return (
      cardName.trim().length >= 2 &&
      /^\d{15,16}$/.test(cardNumber.replace(/\s/g, "")) &&
      /^(0[1-9]|1[0-2])\/\d{2}$/.test(expiry) &&
      /^\d{3,4}$/.test(cvc)
    );
  }

  /**
   * Live price + availability recheck against the server (spec §30/§44).
   * Returns true when it is safe to proceed straight to booking; sets the
   * priceUpdate prompt when the authoritative total differs from what the
   * guest was shown.
   */
  async function recheckPrice(): Promise<boolean> {
    const res = await fetch("/api/bookings/quote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        roomTypeId: props.roomTypeId,
        checkIn,
        checkOut,
        guests,
        addons: selectedAddons,
      }),
    });
    if (!res.ok) {
      setError("We couldn't verify the current price — please try again.");
      return false;
    }
    const data = await res.json();
    if (typeof data.available === "number" && data.available <= 0) {
      setError("No rooms left for these dates — please adjust your stay.");
      return false;
    }
    const serverTotalUsd = data.quote?.totalUsd;
    if (typeof serverTotalUsd !== "number") {
      setError("We couldn't verify the current price — please try again.");
      return false;
    }
    setConfirmedTotalUsd(serverTotalUsd);
    if (Math.abs(serverTotalUsd - localQuote.total) > 0.01) {
      setPriceUpdate({ prevUsd: localQuote.total, nextUsd: serverTotalUsd });
      return false;
    }
    return true;
  }

  async function doSubmit() {
    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomTypeId: props.roomTypeId,
          checkIn,
          checkOut,
          guests,
          addons: selectedAddons,
          guestName,
          guestEmail,
          payment: { cardNumber, expiry, cvc },
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
        return;
      }
      router.push(`/confirmation/${data.code}`);
    } catch {
      setError("Network error — please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  /** Entry point for the pay button: always recheck before booking. */
  async function confirmAndPay() {
    setError(null);
    setPriceUpdate(null);
    setRechecking(true);
    try {
      const ok = await recheckPrice();
      if (ok) {
        setSubmitting(true);
        await doSubmit();
      }
    } catch {
      setError("Network error while checking the current price.");
    } finally {
      setRechecking(false);
    }
  }

  async function acceptUpdatedPrice() {
    setPriceUpdate(null);
    setSubmitting(true);
    await doSubmit();
  }

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1.6fr_1fr]">
      <div>
        {/* stepper */}
        <ol className="mb-8 flex items-center gap-2 sm:gap-3" aria-label="Booking steps">
          {STEPS.map((label, i) => (
            <li key={label} className="flex items-center gap-2 sm:gap-3">
              <button
                type="button"
                onClick={() => i < step && setStep(i)}
                disabled={i > step}
                aria-current={i === step ? "step" : undefined}
                className={`flex items-center gap-2 rounded-full py-1.5 pr-4 pl-1.5 text-sm font-medium transition-all ${
                  i === step
                    ? ""
                    : i < step
                      ? "cursor-pointer hover:bg-raised"
                      : "opacity-45"
                }`}
                style={i === step ? { background: "var(--surface)", border: "1px solid var(--line)" } : undefined}
              >
                <span
                  className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                    i <= step ? "" : "text-on-accent"
                  }`}
                  style={i <= step ? { background: "var(--accent)", color: "var(--on-accent)" } : { background: "var(--line)" }}
                >
                  {i < step ? "✓" : i + 1}
                </span>
                {label}
              </button>
              {i < STEPS.length - 1 && (
                <span aria-hidden className="h-px w-5 sm:w-10" style={{ background: "var(--line)" }} />
              )}
            </li>
          ))}
        </ol>

        {/* STEP 1 — STAY */}
        {step === 0 && (
          <section className="animate-fade-up card space-y-6 p-6 sm:p-8">
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
              <div>
                <label htmlFor="b-in" className="label">Check-in</label>
                <input id="b-in" type="date" className="input" min={toISODate(new Date())} value={checkIn}
                  onChange={(e) => { setCheckIn(e.target.value); if (e.target.value >= checkOut) setCheckOut(toISODate(addDays(new Date(e.target.value), 2))); }} />
              </div>
              <div>
                <label htmlFor="b-out" className="label">Check-out</label>
                <input id="b-out" type="date" className="input" min={toISODate(addDays(new Date(checkIn), 1))} value={checkOut} onChange={(e) => setCheckOut(e.target.value)} />
              </div>
              <div>
                <label htmlFor="b-guests" className="label">Guests (max {props.capacity})</label>
                <select id="b-guests" className="input appearance-none" value={guests} onChange={(e) => setGuests(Number(e.target.value))}>
                  {Array.from({ length: props.capacity }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div>
                <label htmlFor="b-name" className="label">Lead guest name</label>
                <input id="b-name" className="input" placeholder="As on your ID" value={guestName} onChange={(e) => setGuestName(e.target.value)} autoComplete="name" />
              </div>
              <div>
                <label htmlFor="b-email" className="label">Email for confirmation</label>
                <input id="b-email" type="email" className="input" placeholder="you@example.com" value={guestEmail} onChange={(e) => setGuestEmail(e.target.value)} autoComplete="email" />
              </div>
            </div>

            <div
              role="status"
              className="rounded-xl px-4 py-3 text-sm font-medium"
              style={{
                background:
                  available === undefined
                    ? "var(--surface-raised)"
                    : available !== null && available > 0
                      ? "color-mix(in srgb, var(--pine) 12%, transparent)"
                      : "color-mix(in srgb, #c0392b 10%, transparent)",
                color:
                  available === undefined
                    ? "var(--muted)"
                    : available !== null && available > 0
                      ? "var(--pine)"
                      : "#b03a2e",
              }}
            >
              {available === undefined
                ? "Checking live availability…"
                : available === null
                  ? "Select your dates to see availability."
                  : available > 0
                    ? `Good news — ${available} ${available === 1 ? "room" : "rooms"} of this type left for ${formatDate(checkIn)} → ${formatDate(checkOut)}.`
                    : "Sold out for these dates — try shifting by a night."}
            </div>

            <div className="flex justify-end">
              <button type="button" className="btn-primary" disabled={!step1Valid()} onClick={() => setStep(1)}>
                Continue to extras
              </button>
            </div>
          </section>
        )}

        {/* STEP 2 — EXTRAS */}
        {step === 1 && (
          <section className="animate-fade-up card p-6 sm:p-8">
            <h2 className="font-display text-xl font-semibold">Make it yours</h2>
            <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
              Optional — you can always add these later via the concierge.
            </p>
            <ul className="mt-5 space-y-3">
              {ADDONS.map((addon) => {
                const checked = selectedAddons.includes(addon.id);
                return (
                  <li key={addon.id}>
                    <label
                      className="flex cursor-pointer items-start gap-4 rounded-2xl border p-4 transition-all has-checked:border-accent has-checked:bg-raised"
                      style={{ borderColor: checked ? "var(--accent)" : "var(--line)" }}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleAddon(addon.id)}
                        className="mt-1 h-4 w-4 shrink-0 accent-[var(--accent)]"
                      />
                      <span className="flex-1">
                        <span className="block text-sm font-semibold">{addon.label}</span>
                        <span className="mt-0.5 block text-xs" style={{ color: "var(--muted)" }}>
                          {addon.description}
                        </span>
                      </span>
                      <span className="shrink-0 text-sm font-semibold whitespace-nowrap">
                        {usdMoneyText(addon.price, props.rateInfo)}
                        <span className="font-normal" style={{ color: "var(--muted)" }}>
                          {addon.perNight && addon.perGuest ? " /night /guest" : addon.perNight ? " /night" : ""}
                        </span>
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
            <div className="mt-6 flex items-center justify-between">
              <button type="button" className="btn-secondary" onClick={() => setStep(0)}>
                Back
              </button>
              <button type="button" className="btn-primary" onClick={() => setStep(2)}>
                Continue to payment
              </button>
            </div>
          </section>
        )}

        {/* STEP 3 — PAYMENT */}
        {step === 2 && (
          <section className="animate-fade-up card p-6 sm:p-8">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-display text-xl font-semibold">Payment</h2>
              <span
                className="rounded-full px-3 py-1 text-[11px] font-semibold tracking-wide uppercase"
                style={{
                  background: "color-mix(in srgb, var(--pine) 13%, transparent)",
                  color: "var(--pine)",
                }}
              >
                Demo · no real charge
              </span>
            </div>
            <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
              Any valid-looking card works. Nothing is stored or sent to a bank.
            </p>

            <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label htmlFor="c-name" className="label">Name on card</label>
                <input id="c-name" className="input" value={cardName} onChange={(e) => setCardName(e.target.value)} autoComplete="cc-name" placeholder="Ava Laurent" />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="c-num" className="label">Card number</label>
                <input
                  id="c-num"
                  className="input font-mono tracking-widest"
                  inputMode="numeric"
                  placeholder="4242 4242 4242 4242"
                  value={cardNumber}
                  onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
                  autoComplete="cc-number"
                />
              </div>
              <div>
                <label htmlFor="c-exp" className="label">Expiry</label>
                <input id="c-exp" className="input font-mono" inputMode="numeric" placeholder="MM/YY" value={expiry} onChange={(e) => setExpiry(formatExpiry(e.target.value))} autoComplete="cc-exp" />
              </div>
              <div>
                <label htmlFor="c-cvc" className="label">CVC</label>
                <input id="c-cvc" className="input font-mono" inputMode="numeric" placeholder="123" maxLength={4} value={cvc} onChange={(e) => setCvc(e.target.value.replace(/\D/g, "").slice(0, 4))} autoComplete="cc-csc" />
              </div>
            </div>

            {priceUpdate && (
              <div
                role="alertdialog"
                aria-label="Price updated"
                className="animate-fade-up mt-5 rounded-2xl border p-5"
                style={{ borderColor: "var(--gold)", background: "color-mix(in srgb, var(--gold) 10%, transparent)" }}
              >
                <h3 className="font-display text-lg font-semibold">Price updated</h3>
                <p className="mt-1.5 text-sm" style={{ color: "var(--muted)" }}>
                  The current rate for your dates has changed since you started.
                </p>
                <dl className="mt-3 space-y-1 text-sm">
                  <div className="flex justify-between gap-4">
                    <dt style={{ color: "var(--muted)" }}>Previous total</dt>
                    <dd className="line-through opacity-70">{usdMoneyText(priceUpdate.prevUsd, props.rateInfo)}</dd>
                  </div>
                  <div className="flex justify-between gap-4 font-semibold">
                    <dt>Current total</dt>
                    <dd>{usdMoneyText(priceUpdate.nextUsd, props.rateInfo)}</dd>
                  </div>
                </dl>
                <p className="mt-3 text-xs" style={{ color: "var(--muted)" }}>
                  Please confirm the updated price to continue — the final charge is
                  always re-verified on our server before booking.
                </p>
                <div className="mt-4 flex flex-wrap justify-end gap-2">
                  <button type="button" className="btn-secondary !py-2" onClick={() => setPriceUpdate(null)}>
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn-primary !py-2"
                    disabled={submitting}
                    onClick={() => void acceptUpdatedPrice()}
                  >
                    {submitting ? "Booking…" : `Confirm & pay ${usdMoneyText(priceUpdate.nextUsd, props.rateInfo)}`}
                  </button>
                </div>
              </div>
            )}

            {error && (
              <p role="alert" className="mt-5 rounded-xl px-4 py-3 text-sm font-medium" style={{ background: "color-mix(in srgb, #c0392b 10%, transparent)", color: "#b03a2e" }}>
                {error}
              </p>
            )}

            <div className="mt-6 flex items-center justify-between gap-3">
              <button type="button" className="btn-secondary" onClick={() => setStep(1)} disabled={submitting || rechecking}>
                Back
              </button>
              <button type="button" className="btn-primary min-w-52" disabled={!step3Valid() || submitting || rechecking} onClick={() => void confirmAndPay()}>
                {rechecking ? (
                  <>
                    <span aria-hidden className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    Checking current price…
                  </>
                ) : submitting ? (
                  <>
                    <span aria-hidden className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    Confirming…
                  </>
                ) : (
                  `Confirm & pay ${usdMoneyText(quote.total, props.rateInfo)}`
                )}
              </button>
            </div>
          </section>
        )}
      </div>

      {/* SUMMARY */}
      <aside className="lg:sticky lg:top-24 lg:self-start">
        <div className="card overflow-hidden p-0">
          <div className="border-b border-line p-6 pb-5">
            <p className="eyebrow">{props.hotelName}</p>
            <h3 className="font-display mt-1 text-xl font-semibold">{props.roomName}</h3>
            <p className="mt-0.5 text-xs" style={{ color: "var(--muted)" }}>
              {props.city} · {props.bedType} · {props.viewLabel}
            </p>
          </div>
          <dl className="space-y-2.5 p-6 text-sm">
            <div className="flex justify-between gap-4">
              <dt style={{ color: "var(--muted)" }}>
                {usdMoneyText(props.basePrice, props.rateInfo)} × {Math.max(nights, 0)}{" "}
                {nights === 1 ? "night" : "nights"}
              </dt>
              <dd>{usdMoneyText(quote.roomsSubtotal, props.rateInfo)}</dd>
            </div>
            {quote.addons.map((a) => (
              <div key={a.id} className="flex justify-between gap-4">
                <dt style={{ color: "var(--muted)" }}>{a.label}</dt>
                <dd>{usdMoneyText(a.amount, props.rateInfo)}</dd>
              </div>
            ))}
            {quote.serviceFee > 0 && (
              <div className="flex justify-between gap-4">
                <dt style={{ color: "var(--muted)" }}>Service fee</dt>
                <dd>{usdMoneyText(quote.serviceFee, props.rateInfo)}</dd>
              </div>
            )}
            <div className="flex justify-between gap-4">
              <dt style={{ color: "var(--muted)" }}>Taxes & fees (12%)</dt>
              <dd>{usdMoneyText(quote.taxesFees, props.rateInfo)}</dd>
            </div>
            <div className="flex justify-between gap-4 border-t border-line pt-3.5">
              <dt className="font-display text-base font-semibold">Total</dt>
              <dd className="font-display text-lg font-semibold">{usdMoneyText(quote.total, props.rateInfo)}</dd>
            </div>
          </dl>
          <p className="px-6 pb-6 text-xs leading-relaxed" style={{ color: "var(--muted)" }}>
            Free cancellation until 48 hours before check-in. Prices update live
            as you change dates and extras.
          </p>
        </div>
      </aside>
    </div>
  );
}
