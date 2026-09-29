import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import QRCode from "qrcode";
import { db } from "@/lib/db";
import { formatDate, nightsBetween, addDays, toISODate } from "@/lib/format";
import { formatINR } from "@/lib/format";
import { getUsdToInrRate, usdMoneyText } from "@/lib/currency";
import { PrintButton } from "@/components/print-button";

interface PageProps {
  params: Promise<{ code: string }>;
}

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return { title: "Booking confirmed" };
}

export default async function ConfirmationPage({ params }: PageProps) {
  const inr = await getUsdToInrRate();
  const { code } = await params;
  const booking = await db.booking.findUnique({
    where: { code: decodeURIComponent(code) },
    include: { roomType: { include: { hotel: true } } },
  });
  if (!booking) notFound();
  const isDataset = !booking.roomType;

  const room = booking.roomType!;
  const hotel = room.hotel;
  const addons = JSON.parse(booking.addons) as { id: string; label: string; amount: number }[];

  const qrDataUrl = await QRCode.toDataURL(
    `AURELIA|${booking.code}|${hotel.slug}|${toISODate(booking.checkIn)}`,
    { margin: 1, width: 512, color: { dark: "#211b13", light: "#fffdf8" } }
  );

  const checkInTime = "2:00 PM";
  const checkoutDay = formatDate(booking.checkOut);
  const untilCancel = toISODate(addDays(new Date(booking.checkIn), -2));

  
  if (isDataset) {
    return (
      <div className="container-x pt-8 pb-4">
        <div className="card mx-auto max-w-2xl p-8 text-center">
          <p className="eyebrow">Booking confirmed</p>
          <h1 className="font-display mt-2 text-3xl font-semibold">{booking.hotelName}</h1>
          <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
            {booking.destinationLabel} · {booking.roomName}
          </p>
          <dl className="mt-6 space-y-2 text-sm">
            <div className="flex justify-between"><dt style={{color:"var(--muted)"}}>Stay</dt><dd>{formatDate(booking.checkIn)} → {formatDate(booking.checkOut)} · {booking.nights} {booking.nights===1?"night":"nights"}</dd></div>
            <div className="flex justify-between"><dt style={{color:"var(--muted)"}}>Total</dt><dd className="font-display text-lg font-semibold">{formatINR(booking.totalInr ?? booking.total)}</dd></div>
            <div className="flex justify-between"><dt style={{color:"var(--muted)"}}>Confirmation</dt><dd className="font-mono font-semibold">{booking.code}</dd></div>
          </dl>
          <Link href="/trips" className="btn-primary mt-7 inline-flex">View my trips</Link>
        </div>
      </div>
    );
  }
return (
    <div className="container-x pt-10 pb-4">
      <div className="animate-fade-up mx-auto max-w-3xl">
        <div className="text-center">
          <span
            aria-hidden
            className="mx-auto flex h-14 w-14 items-center justify-center rounded-full"
            style={{ background: "color-mix(in srgb, var(--pine) 15%, transparent)", color: "var(--pine)" }}
          >
            <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6 9 17l-5-5" />
            </svg>
          </span>
          <p className="eyebrow mt-4">You&apos;re going</p>
          <h1 className="font-display mt-2 text-3xl font-semibold text-balance sm:text-4xl">
            Your stay at {hotel.name} is confirmed
          </h1>
          <p className="mt-3 text-sm" style={{ color: "var(--muted)" }}>
            A copy has been &ldquo;emailed&rdquo; to{" "}
            <strong style={{ color: "var(--ink)" }}>{booking.guestEmail}</strong> (demo).
          </p>
        </div>

        {/* voucher */}
        <div className="card mt-10 overflow-hidden p-0">
          <div
            className="flex items-center justify-between px-7 py-5"
            style={{
              background: "color-mix(in srgb, var(--accent) 10%, transparent)",
              borderBottom: "1px solid var(--line)",
            }}
          >
            <div>
              <p className="font-display text-lg font-semibold tracking-[0.08em] uppercase">
                Aurelia e-voucher
              </p>
              <p className="text-xs" style={{ color: "var(--muted)" }}>
                Show the QR at reception — no paperwork needed
              </p>
            </div>
            <p className="font-mono text-sm font-semibold tracking-[0.18em]">{booking.code}</p>
          </div>

          <div className="grid grid-cols-1 gap-8 p-7 sm:grid-cols-[1fr_auto]">
            <dl className="grid grid-cols-2 gap-x-6 gap-y-5 text-sm sm:grid-cols-3">
              <div>
                <dt className="label !mb-1">Guest</dt>
                <dd className="font-medium">{booking.guestName}</dd>
              </div>
              <div>
                <dt className="label !mb-1">Check-in</dt>
                <dd className="font-medium">{formatDate(booking.checkIn)} · {checkInTime}</dd>
              </div>
              <div>
                <dt className="label !mb-1">Check-out</dt>
                <dd className="font-medium">{checkoutDay} · 11:00 AM</dd>
              </div>
              <div>
                <dt className="label !mb-1">Hotel</dt>
                <dd className="font-medium">
                  {hotel.name}, {hotel.city}
                </dd>
              </div>
              <div>
                <dt className="label !mb-1">Room</dt>
                <dd className="font-medium">{room.name}</dd>
              </div>
              <div>
                <dt className="label !mb-1">Guests</dt>
                <dd className="font-medium">
                  {booking.guests} · {nightsBetween(toISODate(booking.checkIn), toISODate(booking.checkOut))} nights
                </dd>
              </div>
            </dl>

            <div className="flex flex-col items-center justify-center border-t border-dashed pt-6 sm:border-t-0 sm:border-l sm:pt-0 sm:pl-8">
              <Image
                src={qrDataUrl}
                alt={`QR code for booking ${booking.code}`}
                width={132}
                height={132}
                unoptimized
                className="rounded-xl"
                style={{ border: "1px solid var(--line)" }}
              />
              <p className="mt-2 text-[11px] tracking-[0.14em] uppercase" style={{ color: "var(--muted)" }}>
                Scan at arrival
              </p>
            </div>
          </div>

          {/* folio */}
          <div className="border-t border-line px-7 py-5">
            <p className="label">Folio summary</p>
            <dl className="mt-1 space-y-1.5 text-sm">
              <div className="flex justify-between">
                <dt style={{ color: "var(--muted)" }}>Room subtotal</dt>
                <dd>{usdMoneyText(booking.subtotal, inr)}</dd>
              </div>
              {addons.length > 0 && (
                <div className="flex justify-between text-xs" style={{ color: "var(--muted)" }}>
                  <dt>Including extras</dt>
                  <dd>{addons.map((a) => a.label).join(" · ")}</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt style={{ color: "var(--muted)" }}>Taxes & fees</dt>
                <dd>{usdMoneyText(booking.taxesFees, inr)}</dd>
              </div>
              <div className="flex justify-between pt-1.5 font-semibold">
                <dt>Paid (demo)</dt>
                <dd>{booking.totalInr ? formatINR(booking.totalInr) : usdMoneyText(booking.total, inr)}</dd>
              </div>
            </dl>
          </div>

          <div className="flex flex-wrap items-center gap-3 border-t border-line px-7 py-5 print:hidden">
            <PrintButton />
            <Link href={`/hotels/${hotel.slug}`} className="btn-secondary !py-2.5">
              View hotel again
            </Link>
            <a
              className="btn-secondary !py-2.5"
              href={`https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(
                `Stay at ${hotel.name}`
              )}&dates=${toISODate(booking.checkIn).replace(/-/g, "")}/${toISODate(
                addDays(new Date(booking.checkOut), 1)
              ).replace(/-/g, "")}&details=${encodeURIComponent(`Confirmation ${booking.code}`)}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Add to calendar
            </a>
          </div>
        </div>

        {/* what's next */}
        <section className="mt-10 print:hidden">
          <h2 className="font-display mb-4 text-xl font-semibold">What happens next</h2>
          <ol className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {[
              {
                t: "Before you arrive",
                d: `Watch for pre-arrival emails — online check-in opens ${formatDate(addDays(new Date(booking.checkIn), -1))}.`,
              },
              {
                t: "At the door",
                d: "Flash your QR code at reception or the kiosk; your digital key follows by app.",
              },
              {
                t: "Flexible plans",
                d: `Free cancellation until ${formatDate(new Date(`${untilCancel}T23:59:59`))} — manage anytime from this voucher.`,
              },
            ].map((s) => (
              <li key={s.t} className="card p-5">
                <h3 className="font-display text-base font-semibold">{s.t}</h3>
                <p className="mt-1.5 text-sm leading-relaxed" style={{ color: "var(--muted)" }}>
                  {s.d}
                </p>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </div>
  );
}
