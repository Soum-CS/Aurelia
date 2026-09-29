"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { formatINR } from "@/lib/format";
import { launchRazorpayCheckout } from "@/lib/razorpay-client";

interface Txn {
  ref: string;
  category: string;
  label: string;
  amountInr: number;
  taxInr: number;
  status: string;
  source: string;
  createdAt: string;
}
interface BillSection {
  category: string;
  title: string;
  subtotalInr: number;
}
interface WalletData {
  hotel: { name: string };
  transactions: Txn[];
  summary: {
    subtotalInr: number;
    taxesIncludedInr: number;
    paidInr: number;
    pendingInr: number;
    grandTotalInr: number;
  };
}

const CATEGORY_TITLES: Record<string, string> = {
  ROOM: "Room",
  FOOD: "Food",
  SERVICES: "Room service",
  SPA: "Spa",
  LAUNDRY: "Laundry",
  ACTIVITIES: "Activities",
  TRANSPORTATION: "Transportation",
  OTHER: "Other",
};

/* Window.Razorpay is declared in dataset-checkout.tsx (shared global). */

export function WalletBill({ bookingCode }: { bookingCode: string }) {
  const [data, setData] = useState<WalletData | null>(null);
  const [invoice, setInvoice] = useState<{ number: string; issuedAt: string; grandTotalInr: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [payState, setPayState] = useState<"idle" | "opening" | "verifying">("idle");
  const [payError, setPayError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/bookings/${bookingCode}/bill`, { cache: "no-store" });
      if (!res.ok) {
        const d = await res.json();
        setError(d.message ?? d.error ?? "The bill could not be loaded right now.");
        return;
      }
      const d = await res.json();
      setData({ hotel: d.hotel ?? { name: "" }, transactions: d.bill.sections.flatMap((s: BillSection & { lines: Txn[] }) => s.lines), summary: d.bill });
      setInvoice(d.invoice);
    } catch {
      setError("Network problem loading your wallet.");
    }
  }, [bookingCode]);

  useEffect(() => {
    void (async () => load())();
  }, [load]);


  async function payNow() {
    if (payState !== "idle" || !data) return;
    setPayError(null);
    setPayState("opening");

    try {
      const res = await fetch(`/api/bookings/${bookingCode}/bill/pay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const d = await res.json();

      if (res.status === 503 && d.error === "PAYMENT_NOT_CONFIGURED") {
        setPayError(d.message);
        setPayState("idle");
        return;
      }
      if (!res.ok || !d.orderId) {
        setPayError(d.error ?? "Payment could not be started. No charge was made. Please try again.");
        setPayState("idle");
        return;
      }

      await launchRazorpayCheckout({
        keyId: d.keyId,
        orderId: d.orderId,
        amountPaise: d.amount,
        currency: d.currency,
        name: "Aurelia",
        description: `Unified stay bill · ${bookingCode}`,
        isTestSimulation: Boolean(d.isTestSimulation) || String(d.orderId).startsWith("order_test_"),
        themeColor: "#8a6217",
        handler: async (response) => {
          setPayState("verifying");
          try {
            const vres = await fetch(`/api/bookings/${bookingCode}/bill/verify`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(response),
            });
            const vd = await vres.json();
            if (vres.ok) {
              await load();
              setPayState("idle");
            } else {
              setPayError(vd.error ?? "Verification failed. Contact the front desk before paying again.");
              setPayState("idle");
            }
          } catch {
            setPayError("Could not verify the payment. Do NOT retry blindly — check with the front desk.");
            setPayState("idle");
          }
        },
        onDismiss: () => {
          setPayError("Payment was cancelled before completion. Nothing has been charged.");
          setPayState("idle");
        },
        onError: (err) => {
          setPayError(err.description ?? "Payment failed at the gateway. No charges were settled — you can try again.");
          setPayState("idle");
        },
      });
    } catch {
      setPayError("Something went wrong starting the payment. No charge was made.");
      setPayState("idle");
    }
  }

  if (error) {
    return (
      <div className="card p-8 text-center">
        <h2 className="font-display text-xl font-semibold">Wallet unavailable</h2>
        <p className="mx-auto mt-2 max-w-sm text-sm" style={{ color: "var(--muted)" }}>{error}</p>
        <button type="button" className="btn-secondary mt-5" onClick={() => location.reload()}>TRY AGAIN</button>
      </div>
    );
  }
  if (!data) {
    return <div className="card animate-pulse p-8 text-center text-sm" style={{ color: "var(--muted)" }}>Opening your wallet…</div>;
  }

  const sections = new Map<string, number>();
  for (const t of data.transactions) {
    sections.set(t.category, (sections.get(t.category) ?? 0) + t.amountInr);
  }

  return (
    <div className="space-y-6">
      {/* wallet summary */}
      <section aria-label="Aurelia wallet" className="card p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-semibold">Aurelia Wallet</h2>
            <p className="mt-0.5 text-xs" style={{ color: "var(--muted)" }}>
              Every rupee on this stay, referenced and reconciled.
            </p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-semibold">{formatINR(data.summary.grandTotalInr)}</p>
            <p className="text-xs" style={{ color: data.summary.pendingInr > 0 ? "#b03a2e" : "var(--pine)" }}>
              {data.summary.pendingInr > 0
                ? `${formatINR(data.summary.pendingInr)} pending`
                : "Fully settled"}
            </p>
          </div>
        </div>

        <table className="mt-4 w-full text-sm">
          <caption className="sr-only">Charges by category</caption>
          <tbody>
            {[...sections.entries()].map(([cat, amt]) => (
              <tr key={cat} className="border-b border-line/60">
                <th scope="row" className="py-2 text-left font-medium" style={{ color: "var(--muted)" }}>
                  {(CATEGORY_TITLES[cat] ?? cat).toUpperCase()}
                </th>
                <td className="py-2 text-right font-semibold">{formatINR(amt)}</td>
              </tr>
            ))}
            <tr>
              <th scope="row" className="pt-2 text-left font-bold uppercase">Subtotal</th>
              <td className="pt-2 text-right font-bold">{formatINR(data.summary.subtotalInr)}</td>
            </tr>
            <tr>
              <th scope="row" className="text-left" style={{ color: "var(--muted)" }}>Taxes included above</th>
              <td className="text-right" style={{ color: "var(--muted)" }}>{formatINR(data.summary.taxesIncludedInr)}</td>
            </tr>
            <tr>
              <th scope="row" className="pt-1 text-left font-bold uppercase tracking-wide">Total</th>
              <td className="pt-1 text-right text-lg font-bold">{formatINR(data.summary.grandTotalInr)}</td>
            </tr>
            <tr>
              <th scope="row" className="text-left text-xs" style={{ color: data.summary.paidInr >= data.summary.grandTotalInr ? "var(--pine)" : "var(--muted)" }}>Paid</th>
              <td className="text-right text-xs" style={{ color: data.summary.paidInr >= data.summary.grandTotalInr ? "var(--pine)" : "var(--muted)" }}>{formatINR(data.summary.paidInr)}</td>
            </tr>
          </tbody>
        </table>

        {data.summary.pendingInr > 0 && (
          <div className="mt-5 rounded-xl border border-line bg-raised p-4">
            <h3 className="text-sm font-bold uppercase tracking-wide">Unified checkout</h3>
            <p className="mt-1 text-xs" style={{ color: "var(--muted)" }}>
              One secure Razorpay payment settles every pending charge on this stay.
            </p>
            {payError && (
              <p role="alert" className="mt-3 rounded-lg border px-3 py-2 text-xs font-medium" style={{ borderColor: "#b03a2e55", background: "#b03a2e11", color: "#b03a2e" }}>
                {payError}
                {payError.includes("RAZORPAY") && (
                  <button type="button" className="ml-2 underline" onClick={payNow}>TRY PAYMENT AGAIN</button>
                )}
              </p>
            )}
            <button
              type="button"
              className="btn-primary mt-3 w-full"
              onClick={payNow}
              disabled={payState !== "idle"}
            >
              {payState === "idle"
                ? `PAY ${formatINR(data.summary.pendingInr)} VIA RAZORPAY`
                : payState === "opening"
                  ? "Opening gateway…"
                  : "Verifying payment…"}
            </button>
          </div>
        )}

        {invoice && (
          <div role="status" className="mt-4 rounded-xl border p-4" style={{ borderColor: "color-mix(in srgb, var(--pine) 30%, transparent)", background: "color-mix(in srgb, var(--pine) 7%, transparent)" }}>
            <p className="text-sm font-bold" style={{ color: "var(--pine)" }}>✓ Invoice {invoice.number} issued · {formatINR(invoice.grandTotalInr)}</p>
            <p className="mt-0.5 text-xs" style={{ color: "var(--muted)" }}>
              Issued {new Date(invoice.issuedAt).toLocaleString("en-IN")} ·{" "}
              <Link href={`/confirmation/${bookingCode}`} className="underline">view voucher & print</Link> ·{" "}
              <a href="#" onClick={(e) => { e.preventDefault(); window.print(); }} className="underline">print / save as PDF</a>
            </p>
          </div>
        )}
      </section>

      {/* transactions */}
      <section aria-label="All transactions" className="card p-5 sm:p-6">
        <h2 className="font-display text-lg font-semibold">Transactions</h2>
        <ul className="mt-3 divide-y divide-line">
          {data.transactions.map((t) => (
            <li key={t.ref} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
              <span className="min-w-0">
                <strong>{t.label}</strong>
                <span className="block text-[11px]" style={{ color: "var(--muted)" }}>
                  {CATEGORY_TITLES[t.category] ?? t.category} · ref {t.ref} · {new Date(t.createdAt).toLocaleString("en-IN")}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-3">
                <strong>{formatINR(t.amountInr)}</strong>
                <span
                  className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase"
                  style={
                    t.status === "PAID"
                      ? { background: "color-mix(in srgb, var(--pine) 13%, transparent)", color: "var(--pine)" }
                      : t.status === "REFUNDED"
                        ? { background: "var(--line)", color: "var(--muted)" }
                        : { background: "#b03a2e18", color: "#b03a2e" }
                  }
                >
                  {t.status}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
