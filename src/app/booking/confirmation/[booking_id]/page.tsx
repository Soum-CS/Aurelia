import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { db } from "@/lib/db";
import { formatDate, formatINR, nightsBetween } from "@/lib/format";
import { getDatasetHotel } from "@/lib/hotels/csv-provider";
import { PrintReceiptButton } from "@/components/print-receipt-button";
import { EmailReceiptButton } from "@/components/email-receipt-button";

interface PageProps {
  params: Promise<{ booking_id: string }>;
}

export const dynamic = "force-dynamic";

export default async function BookingConfirmationPage({ params }: PageProps) {
  const { booking_id } = await params;
  const booking = await db.booking.findFirst({
    where: { OR: [{ id: booking_id }, { code: booking_id }] },
  });
  if (!booking) notFound();

  /* ── payment failed / pending: explicit state, never a fake success ── */
  const confirmed = booking.status === "CONFIRMED";
  if (!confirmed) {
    return (
      <div className="container-x pt-16 pb-4">
        <div className="card mx-auto max-w-lg p-10 text-center sm:p-12" role="alert">
          <span
            aria-hidden
            className="mx-auto flex h-16 w-16 items-center justify-center rounded-full"
            style={{ background: "#c0392b14", color: "#b03a2e" }}
          >
            <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M12 8v5m0 3.5h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
            </svg>
          </span>
          <h1 className="font-display mt-5 text-2xl font-semibold sm:text-3xl">Payment unsuccessful</h1>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed" style={{ color: "var(--muted)" }}>
            Your payment could not be completed. No booking has been confirmed.
            Current status: {booking.status.replaceAll("_", " ").toLowerCase()}.
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Link href={`/book/${booking.providerBookingId ?? ""}`} className="btn-primary">Try payment again</Link>
            <Link href="/" className="btn-secondary">Back to search</Link>
          </div>
        </div>
      </div>
    );
  }

  /* ── real hotel record where the dataset has one ── */
  let hotelAddress = booking.hotelName ?? "";
  let hotelPhone = "";
  try {
    const hotel = await getDatasetHotel(booking.providerBookingId ?? "");
    if (hotel) {
      hotelAddress = `${hotel.name}, ${hotel.address}`;
      hotelPhone = hotel.phone_number;
    }
  } catch {
    /* provider unavailable — show what the booking itself records */
  }

  const nights = nightsBetween(
    booking.checkIn.toISOString().slice(0, 10),
    booking.checkOut.toISOString().slice(0, 10),
  );
  const totalPaid = formatINR(booking.totalInr ?? booking.total);

  // QR encodes the actual confirmation URL of this booking
  const confirmUrl = `https://aurelia.stay/confirm/${booking.code}`;
  const qrDataUrl = await QRCode.toDataURL(`AURELIA|${booking.code}|${confirmUrl}`, {
    margin: 1,
    width: 448,
    color: { dark: "#211b13", light: "#fffdf8" },
  });

  return (
    <div className="container-x pt-12 pb-20">
      {/* ── premium confirmation card ── */}
      <article data-print="invoice-card" className="card animate-fade-up mx-auto max-w-2xl overflow-hidden p-0">
        {/* letterhead */}
        <header className="relative px-8 pt-9 pb-7 text-center text-white sm:px-12">
          <div aria-hidden className="absolute inset-0" style={{ background: "linear-gradient(135deg, var(--accent-strong), var(--accent))" }} />
          <div className="relative">
            <p className="font-display text-2xl font-semibold tracking-[0.32em] uppercase">Aurelia</p>
            <p className="mt-1.5 inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-1 text-xs font-bold tracking-[0.18em] uppercase backdrop-blur-sm">
              ✓ Booking confirmed
            </p>
          </div>
        </header>

        <div className="px-8 py-8 sm:px-12">
          <div className="text-center">
            <h1 className="font-display text-2xl font-semibold sm:text-3xl">{booking.hotelName}</h1>
            <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>{booking.roomName}</p>
          </div>

          <dl className="mt-8 grid grid-cols-2 gap-x-6 gap-y-6 text-center">
            <div>
              <dt className="label !mb-1">Check-in</dt>
              <dd className="font-display text-lg font-semibold">{formatDate(booking.checkIn)}</dd>
              <dd className="text-xs" style={{ color: "var(--muted)" }}>from 2:00 PM</dd>
            </div>
            <div>
              <dt className="label !mb-1">Check-out</dt>
              <dd className="font-display text-lg font-semibold">{formatDate(booking.checkOut)}</dd>
              <dd className="text-xs" style={{ color: "var(--muted)" }}>by 11:00 AM · {nights} night{nights === 1 ? "" : "s"}</dd>
            </div>
          </dl>

          <div className="mt-7 flex flex-col items-center gap-6 border-t border-line pt-7 sm:flex-row sm:text-left">
            <Image
              src={qrDataUrl}
              alt={`QR code for booking ${booking.code}`}
              width={128}
              height={128}
              className="animate-fade-up rounded-xl border border-line"
              priority
            />
            <dl className="grid flex-1 grid-cols-1 gap-x-6 gap-y-2.5 text-sm sm:grid-cols-2">
              <div>
                <dt className="label !mb-0.5">Guest</dt>
                <dd className="font-medium">{booking.guestName}</dd>
                <dd className="text-xs" style={{ color: "var(--muted)" }}>{booking.guests} guest{booking.guests === 1 ? "" : "s"} · {booking.rooms} room{booking.rooms === 1 ? "" : "s"}</dd>
              </div>
              <div>
                <dt className="label !mb-0.5">Booking ID</dt>
                <dd className="font-mono text-sm leading-5 font-semibold">{booking.code}</dd>
              </div>
              <div>
                <dt className="label !mb-0.5">Payment</dt>
                <dd className="font-semibold" style={{ color: "var(--pine)" }}>✓ PAID · Razorpay</dd>
                {booking.paymentId && (
                  <dd className="font-mono text-[10px] leading-4" style={{ color: "var(--muted)" }}>{booking.paymentId}</dd>
                )}
              </div>
              <div>
                <dt className="label !mb-0.5">Total paid</dt>
                <dd className="font-display text-lg font-semibold">{totalPaid}</dd>
              </div>
            </dl>
          </div>

          <p className="mt-7 text-center text-[11px] leading-relaxed" style={{ color: "var(--muted)" }}>
            Show this QR at reception for a contactless check-in. Invoice and receipt
            below carry the same verified figures as this card.
          </p>
        </div>
      </article>

      {/* ── actions ── */}
      <div className="no-print mx-auto mt-7 flex max-w-2xl flex-wrap items-start justify-center gap-3">
        <Link href={`/trips/${booking.code}`} className="btn-primary">View my stay →</Link>
        <a href={`/api/bookings/${encodeURIComponent(booking.code)}/invoice`} className="btn-secondary" download>
          ⬇ Download PDF invoice
        </a>
        <PrintReceiptButton />
        <EmailReceiptButton />
      </div>

      {/* ── inline invoice (print target) ── */}
      <InvoiceSection
        booking={{
          code: booking.code,
          guestName: booking.guestName,
          guestEmail: booking.guestEmail,
          guestPhone: booking.guestPhone,
          createdAt: formatDate(booking.createdAt),
          checkIn: formatDate(booking.checkIn),
          checkOut: formatDate(booking.checkOut),
          guests: booking.guests,
          rooms: booking.rooms,
          nights,
        }}
        hotel={{ nameLine: hotelAddress, phone: hotelPhone }}
        room={booking.roomName ?? ""}
        money={{
          subtotal: formatINR(booking.subtotal),
          taxes:
            booking.taxesFees > 0
              ? formatINR(booking.taxesFees)
              : "Included in room rate",
          total: totalPaid,
        }}
        payment={{
          status: booking.paymentStatus === "PAID" ? "PAID" : booking.paymentStatus ?? "—",
          method: "Razorpay",
          id: booking.paymentId,
        }}
      />
    </div>
  );
}

/* ── itemized invoice rendered from backend values ── */
function InvoiceSection({
  booking,
  hotel,
  room,
  money,
  payment,
}: {
  booking: {
    code: string; guestName: string; guestEmail: string; guestPhone: string | null;
    createdAt: string; checkIn: string; checkOut: string; guests: number; rooms: number; nights: number;
  };
  hotel: { nameLine: string; phone: string };
  room: string;
  money: { subtotal: string; taxes: string; total: string };
  payment: { status: string; method: string; id: string | null };
}) {
  return (
    <section data-print className="card mx-auto mt-12 max-w-2xl p-8 sm:p-10" aria-label="Invoice">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b-2 pb-5" style={{ borderColor: "var(--accent)" }}>
        <div>
          <p className="font-display text-2xl font-semibold tracking-[0.28em] uppercase">Aurelia</p>
          <p className="mt-1 max-w-xs text-xs leading-relaxed" style={{ color: "var(--muted)" }}>
            {hotel.nameLine}
            {hotel.phone ? ` · ${hotel.phone}` : ""}
          </p>
        </div>
        <div className="text-right text-xs" style={{ color: "var(--muted)" }}>
          <p className="font-mono text-sm font-semibold" style={{ color: "var(--ink)" }}>INV-{booking.code.replace("AUR-", "")}</p>
          <p>Issued {booking.createdAt}</p>
        </div>
      </header>

      <div className="mt-6 grid grid-cols-1 gap-6 text-sm sm:grid-cols-2">
        <div>
          <p className="label !mb-1">Billed to</p>
          <p className="font-semibold">{booking.guestName}</p>
          <p style={{ color: "var(--muted)" }}>{booking.guestEmail}</p>
          {booking.guestPhone && <p style={{ color: "var(--muted)" }}>{booking.guestPhone}</p>}
        </div>
        <div className="sm:text-right">
          <p className="label !mb-1">Stay</p>
          <p>{booking.checkIn} → {booking.checkOut}</p>
          <p style={{ color: "var(--muted)" }}>
            {room || "Room"} · {booking.guests} guest{booking.guests === 1 ? "" : "s"} · {booking.nights} night{booking.nights === 1 ? "" : "s"}
          </p>
          <p className="font-mono text-xs" style={{ color: "var(--muted)" }}>Booking {booking.code}</p>
        </div>
      </div>

      <table className="mt-7 w-full text-sm">
        <caption className="sr-only">Itemized charges for booking {booking.code}</caption>
        <thead>
          <tr className="border-b border-line text-left text-[11px] tracking-widest uppercase" style={{ color: "var(--muted)" }}>
            <th scope="col" className="py-2 font-semibold">Charges</th>
            <th scope="col" className="py-2 text-right font-semibold">Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-b border-line/60">
            <td className="py-2.5">Accommodation · per-night rate × {booking.nights} night{booking.nights === 1 ? "" : "s"} × {booking.rooms} room{booking.rooms === 1 ? "" : "s"} (taxes included)</td>
            <td className="py-2.5 text-right font-medium">{money.subtotal}</td>
          </tr>
          <tr className="border-b border-line/60">
            <td className="py-2.5">Taxes & fees</td>
            <td className="py-2.5 text-right font-medium">{money.taxes}</td>
          </tr>
          <tr>
            <th scope="row" className="pt-3 text-left font-display text-base font-semibold uppercase">Grand total</th>
            <td className="pt-3 text-right font-display text-lg font-semibold">{money.total}</td>
          </tr>
        </tbody>
      </table>

      <div className="mt-6 rounded-2xl p-4 text-sm" style={{ background: "color-mix(in srgb, var(--pine) 8%, transparent)" }}>
        <div className="flex flex-wrap justify-between gap-x-8 gap-y-1.5">
          <span><strong>Payment:</strong> {payment.status}</span>
          <span><strong>Method:</strong> {payment.method}</span>
        </div>
        {payment.id && (
          <p className="mt-1 font-mono text-xs" style={{ color: "var(--muted)" }}>Payment ID: {payment.id}</p>
        )}
      </div>

      <footer className="mt-8 border-t border-line pt-5 text-center">
        <p className="font-display text-sm font-semibold">Thank you for choosing Aurelia.</p>
        <p className="mt-1 text-xs" style={{ color: "var(--muted)" }}>
          See your stay. Shape your stay. Live your stay.
        </p>
      </footer>
    </section>
  );
}
