import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getBookingByCode } from "@/lib/data";
import { formatDate } from "@/lib/format";
import { getUsdToInrRate, usdMoneyText } from "@/lib/currency";
import { CheckoutButton } from "@/components/checkout-button";
import { PrintButton } from "@/components/print-button";

interface PageProps {
  params: Promise<{ code: string }>;
}

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return { title: "Checkout" };
}

export default async function CheckoutPage({ params }: PageProps) {
  const inr = await getUsdToInrRate();
  const { code } = await params;
  const booking = await getBookingByCode(decodeURIComponent(code));
  if (!booking) notFound();

  if (booking.status === "CONFIRMED") {
    return (
      <div className="container-x py-24 text-center">
        <h1 className="font-display text-2xl font-semibold">You haven&apos;t checked in yet</h1>
        <p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>
          Complete your digital check-in first — then checkout takes one tap.
        </p>
        <Link href={`/trips/${booking.code}/check-in`} className="btn-primary mt-6">
          Go to check-in
        </Link>
      </div>
    );
  }

  const hotel = booking.roomType.hotel;
  const checkedOut = booking.status === "CHECKED_OUT";
  const extras = booking.serviceRequests.filter((r) => r.price > 0);
  const extrasTotal = extras.reduce((s, r) => s + r.price, 0);
  const grandTotal = booking.total + extrasTotal;

  return (
    <div className="container-x pt-8 pb-4">
      <nav aria-label="Breadcrumb" className="mb-6 text-sm print:hidden" style={{ color: "var(--muted)" }}>
        <Link href="/trips" className="hover:text-accent transition-colors">My trips</Link>
        <span aria-hidden className="mx-2">/</span>
        <span style={{ color: "var(--ink)" }}>Checkout · {booking.code}</span>
      </nav>

      {!checkedOut ? (
        <div className="mx-auto max-w-2xl">
          <p className="eyebrow">One-tap checkout</p>
          <h1 className="font-display mt-2 text-3xl font-semibold sm:text-4xl">
            Leaving {hotel.name}?
          </h1>
          <p className="mt-3 text-sm leading-relaxed" style={{ color: "var(--muted)" }}>
            Review the folio below. Your card on file settles everything — no queue,
            no key return, just leave the memories.
          </p>

          <div className="card mt-8 p-6 sm:p-8">
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between">
                <dt>Room · {booking.nights} nights ({formatDate(booking.checkIn)} →)</dt>
                <dd>{usdMoneyText(booking.subtotal, inr)}</dd>
              </div>
              <div className="flex justify-between" style={{ color: "var(--muted)" }}>
                <dt>Taxes & fees already included</dt>
                <dd>{usdMoneyText(booking.taxesFees, inr)}</dd>
              </div>
              {extras.length > 0 && (
                <>
                  <li aria-hidden className="border-t border-line !mt-4 !mb-1 list-none" />
                  {extras.map((r) => (
                    <div key={r.id} className="flex justify-between">
                      <dt>
                        {r.title}
                        {r.kind === "ROOM_SERVICE" && (
                          <span style={{ color: "var(--muted)" }}> · room service</span>
                        )}
                      </dt>
                      <dd>{usdMoneyText(r.price, inr)}</dd>
                    </div>
                  ))}
                </>
              )}
              <div className="flex justify-between border-t border-line pt-4 font-display text-lg font-semibold">
                <dt>Total due</dt>
                <dd>{usdMoneyText(grandTotal, inr)}</dd>
              </div>
            </dl>

            <div className="mt-7">
              <CheckoutButton bookingCode={booking.code} />
            </div>
          </div>

          <p className="mt-4 text-xs" style={{ color: "var(--muted)" }}>
            Demo note: no real charge happens — the folio is simulated and settled instantly.
          </p>
        </div>
      ) : (
        <div className="mx-auto max-w-2xl">
          <div className="text-center print:hidden">
            <span
              aria-hidden
              className="mx-auto flex h-14 w-14 items-center justify-center rounded-full text-2xl"
              style={{ background: "color-mix(in srgb, var(--pine) 14%, transparent)", color: "var(--pine)" }}
            >
              ✓
            </span>
            <p className="eyebrow mt-4">Checked out</p>
            <h1 className="font-display mt-2 text-3xl font-semibold sm:text-4xl">
              Safe travels, {booking.guestName.split(" ")[0]}
            </h1>
            <p className="mx-auto mt-3 max-w-md text-sm" style={{ color: "var(--muted)" }}>
              Your folio is settled and your invoice is ready. If the stay earned it,
              we&apos;d love to hear how it went.
            </p>
          </div>

          {/* invoice */}
          <article className="card mt-8 overflow-hidden p-0" aria-label="Invoice">
            <header
              className="flex items-start justify-between gap-4 px-7 py-5"
              style={{
                background: "color-mix(in srgb, var(--accent) 9%, transparent)",
                borderBottom: "1px solid var(--line)",
              }}
            >
              <div>
                <p className="font-display text-lg font-semibold tracking-[0.08em] uppercase">Invoice</p>
                <p className="text-xs" style={{ color: "var(--muted)" }}>
                  {hotel.name} · {hotel.address}, {hotel.city}
                </p>
              </div>
              <div className="text-right text-xs" style={{ color: "var(--muted)" }}>
                <p className="font-mono font-semibold tracking-[0.14em]" style={{ color: "var(--ink)" }}>
                  {booking.code}
                </p>
                <p>Issued {formatDate(booking.checkedOutAt ?? new Date())}</p>
              </div>
            </header>

            <div className="px-7 py-6">
              <dl className="space-y-2.5 text-sm">
                <div className="flex justify-between gap-6">
                  <dt style={{ color: "var(--muted)" }}>
                    {booking.roomType.name} · {booking.guests} guests ·{" "}
                    {formatDate(booking.checkIn)} → {formatDate(booking.checkOut)}
                  </dt>
                  <dd className="whitespace-nowrap">{usdMoneyText(booking.subtotal, inr)}</dd>
                </div>
                {extras.map((r) => (
                  <div key={r.id} className="flex justify-between gap-6">
                    <dt style={{ color: "var(--muted)" }}>{r.title}</dt>
                    <dd className="whitespace-nowrap">{usdMoneyText(r.price, inr)}</dd>
                  </div>
                ))}
                <div className="flex justify-between gap-6">
                  <dt style={{ color: "var(--muted)" }}>Taxes & fees</dt>
                  <dd className="whitespace-nowrap">{usdMoneyText(booking.taxesFees, inr)}</dd>
                </div>
                <div
                  className="flex justify-between gap-6 border-t border-line pt-3 font-semibold"
                  style={{ fontSize: "1.05rem" }}
                >
                  <dt>Paid in full (demo)</dt>
                  <dd>{usdMoneyText(grandTotal, inr)}</dd>
                </div>
              </dl>
            </div>

            <footer className="flex flex-wrap items-center gap-3 border-t border-line px-7 py-5 print:hidden">
              <PrintButton label="Download PDF (print)" />
              {!booking.review && (
                <Link href={`/trips/${booking.code}/feedback`} className="btn-primary !py-2.5">
                  Leave a review
                </Link>
              )}
              {booking.review && (
                <Link href="/trips" className="btn-secondary !py-2.5">
                  Back to my trips
                </Link>
              )}
            </footer>
          </article>

          <section className="card mt-6 flex flex-wrap items-center justify-between gap-4 p-5 print:hidden">
            <div>
              <p className="eyebrow !text-[10px]">Aurelia Rewards</p>
              <p className="mt-1 text-sm font-semibold">
                +{booking.nights} nights banked toward your next tier
              </p>
              <p className="text-xs" style={{ color: "var(--muted)" }}>
                Refer a friend with code {booking.code.slice(-6)} — you both get credit when they book.
              </p>
            </div>
            <Link href="/" className="btn-secondary !py-2.5">
              Plan another escape
            </Link>
          </section>
        </div>
      )}
    </div>
  );
}
