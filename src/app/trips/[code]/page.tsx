import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { formatDate, formatINR } from "@/lib/format";
import {
  deriveStayStage,
  stageLabel,
  countdownTo,
  resolveHotelForBooking,
  ensureRoomWalletTxn,
  getWalletTxns,
  buildUnifiedBill,
  ensureRestaurantForStay,
  type StayStage,
} from "@/lib/stay";
import { STAGE_ORDER } from "@/lib/stay";
import { StayConcierge } from "@/components/stay/stay-concierge";
import { DigitalRoomKey } from "@/components/stay/digital-key";
import { LoyaltyBadge } from "@/components/stay/loyalty-badge";

interface PageProps {
  params: Promise<{ code: string }>;
}

export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  return { title: "My Aurelia Stay" };
}

export default async function MyStayPage({ params }: PageProps) {
  const { code } = await params;
  const decoded = decodeURIComponent(code);
  const booking = await db.booking.findUnique({
    where: { code: decoded },
    include: {
      roomType: { include: { hotel: true } },
      serviceRequests: true,
      review: { select: { id: true } },
    },
  });
  if (!booking) notFound();

  const stage = deriveStayStage(booking);
  const hotel = await resolveHotelForBooking(booking);
  await ensureRoomWalletTxn(booking);
  const [orders, expBookings] = await Promise.all([
    db.foodOrder.findMany({ where: { bookingId: booking.id }, orderBy: { createdAt: "desc" }, take: 5 }),
    db.experienceBooking.findMany({ where: { bookingId: booking.id }, include: { experience: true }, orderBy: { createdAt: "desc" }, take: 5 }),
  ]);

  const wallet = await getWalletTxns(booking.id);
  const bill = buildUnifiedBill(wallet);
  const now = new Date();
  const ciCd = countdownTo(new Date(booking.checkIn), now);
  const coCd = countdownTo(new Date(booking.checkOut), now);

  const restaurant = await ensureRestaurantForStay(booking, hotel);

  const stageIndex = STAGE_ORDER.indexOf(stage as StayStage);
  const activeOrders = orders.filter((o) => !["DELIVERED", "CANCELLED"].includes(o.status));
  const openRequests = booking.serviceRequests.filter((r) => r.status !== "RESOLVED");

  return (
    <div className="container-x pt-8 pb-4">
      {/* header */}
      <nav aria-label="Breadcrumb" className="mb-6 text-sm" style={{ color: "var(--muted)" }}>
        <Link href="/trips" className="hover:text-accent transition-colors">My trips</Link>
        <span aria-hidden className="mx-2">/</span>
        <span style={{ color: "var(--ink)" }}>My Aurelia Stay</span>
      </nav>

      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">My Aurelia Stay · {hotel?.name ?? booking.hotelName}</p>
          <h1 className="font-display mt-2 text-3xl font-semibold sm:text-4xl">
            See your stay. Shape your stay.
          </h1>
        </div>
        {stage === "BOOKED" || stage === "PRE_ARRIVAL" ? (
          <Link href={`/trips/${booking.code}/check-in`} className="btn-primary">Digital check-in →</Link>
        ) : stage === "CHECKOUT" ? (
          <Link href={`/trips/${booking.code}/checkout`} className="btn-primary">Checkout →</Link>
        ) : null}
      </header>

      {/* stay facts */}
      <section aria-label="Stay details" className="card mb-6 p-5 sm:p-6">
        <div className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm sm:grid-cols-3 lg:grid-cols-6">
          {[
            ["Hotel", hotel?.name ?? booking.hotelName ?? "—"],
            ["Room", `${booking.roomNumber ? `#${booking.roomNumber} · ` : ""}${booking.roomName ?? booking.roomType?.name ?? "—"}`],
            ["Check-in", formatDate(booking.checkIn)],
            ["Check-out", formatDate(booking.checkOut)],
            ["Guests", String(booking.guests)],
            ["Booking ID", booking.code],
          ].map(([k, v]) => (
            <div key={k}>
              <p className="text-[11px] font-semibold tracking-wide uppercase" style={{ color: "var(--muted)" }}>{k}</p>
              <p className="mt-1 font-medium">{v}</p>
            </div>
          ))}
        </div>
        <div className="mt-5 flex flex-wrap gap-x-8 gap-y-2 border-t border-line pt-4 text-sm">
          <span>
            Payment:{" "}
            <strong style={{ color: booking.paymentStatus === "PAID" ? "var(--pine)" : "var(--accent)" }}>
              {booking.paymentStatus ?? "—"}
            </strong>
          </span>
          <span>Stay duration: <strong>{booking.nights} night{booking.nights === 1 ? "" : "s"}</strong></span>
          {ciCd && ciCd.ms > 0 && stage !== "COMPLETED" && (
            <span>Check-in in <strong>{ciCd.text}</strong></span>
          )}
          {coCd && coCd.ms > 0 && ["CHECKED_IN", "IN_STAY", "CHECKOUT"].includes(stage) && (
            <span>Checkout in <strong>{coCd.text}</strong></span>
          )}
          <span>
            Status:{" "}
            <strong className="rounded-full px-2 py-0.5 text-xs" style={{ background: "color-mix(in srgb, var(--accent) 12%, transparent)", color: "var(--accent)" }}>
              {stageLabel(stage).toUpperCase()}
            </strong>
          </span>
        </div>

        {/* lifecycle */}
        <ol aria-label="Stay progress" className="mt-5 flex flex-wrap items-center gap-y-2 text-[11px] font-semibold tracking-wide">
          {(["BOOKED", "PRE_ARRIVAL", "CHECKED_IN", "IN_STAY", "CHECKOUT", "COMPLETED"] as const).map((s, i) => {
            const done = stageIndex > i || stage === "COMPLETED";
            const current = stageIndex === i;
            return (
              <li key={s} className="flex items-center">
                <span
                  aria-current={current ? "step" : undefined}
                  className={`rounded-full px-2.5 py-1 ${current ? "" : done ? "" : "opacity-50"}`}
                  style={{
                    background: current
                      ? "var(--accent)"
                      : done
                        ? "color-mix(in srgb, var(--pine) 14%, transparent)"
                        : "var(--line)",
                    color: current ? "var(--on-accent)" : done ? "var(--pine)" : "var(--muted)",
                  }}
                >
                  {done && !current ? "✓ " : ""}{stageLabel(s).toUpperCase()}
                </span>
                {i < 5 && <span aria-hidden className="mx-1.5 opacity-40">→</span>}
              </li>
            );
          })}
        </ol>
      </section>

      {/* digital twin map */}
      <section aria-label="My digital stay map" className="card mb-6 p-5 sm:p-6">
        <h2 className="font-display text-lg font-semibold">My digital stay</h2>
        <p className="mb-5 mt-0.5 text-xs" style={{ color: "var(--muted)" }}>
          One connected environment for everything on this stay — every tile runs on live booking data.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          <TwinTile href={`/trips/${booking.code}`} emoji="🛏️" title="ROOM" subtitle={booking.roomNumber ? `Room ${booking.roomNumber}` : booking.roomType?.name ?? ""} note={["BOOKED","PRE_ARRIVAL"].includes(stage) ? "Check-in pending" : stageLabel(stage)} />
          <TwinTile href={`/trips/${booking.code}/stay-pass`} emoji="🎫" title="STAY PASS" subtitle="Verified Pass" note="Live QR code" />
          <TwinTile href={`/trips/${booking.code}#digital-key`} emoji="🔑" title="DIGITAL KEY" subtitle={booking.roomNumber ? `Room ${booking.roomNumber}` : "Key card"} note={["CHECKED_IN", "IN_STAY"].includes(stage) ? "Tap to unlock" : "Tap to test"} />
          <TwinTile href={`/trips/${booking.code}/stay/food`} emoji="🍛" title="FOOD" subtitle={restaurant ? restaurant.name : "Not configured"} note={`${activeOrders.length} active order${activeOrders.length === 1 ? "" : "s"}`} />
          <TwinTile href={`/trips/${booking.code}/stay/services`} emoji="🧺" title="SERVICES" subtitle="Housekeeping & more" note={`${openRequests.length} open`} />
          <TwinTile href={`/trips/${booking.code}/stay/experiences`} emoji="🌅" title="EXPERIENCES" subtitle={hotel?.city ?? booking.destinationLabel ?? "Nearby"} note={`${expBookings.length} planned`} />
          <TwinTile href={`/trips/${booking.code}?concierge=1#concierge`} emoji="🤵" title="AI CONCIERGE" subtitle="Natural language" note="Ask anything" />
          <TwinTile href={`/trips/${booking.code}/stay/wallet`} emoji="💳" title="WALLET & BILL" subtitle={formatINR(bill.grandTotalInr)} note={bill.pendingInr > 0 ? `${formatINR(bill.pendingInr)} pending` : "Fully settled"} />
          <TwinTile href={`/trips/${booking.code}#loyalty`} emoji="✨" title="LOYALTY" subtitle="Aurelia Club" note="Tier & Perks" />
          <TwinTile href={`/booking/confirmation/${booking.code}`} emoji="🧾" title="INVOICE & QR" subtitle={stage === "COMPLETED" ? "Receipt ready" : "Voucher & receipt"} note="PDF · print · email" />
        </div>
      </section>

      {/* digital room key & loyalty status */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div id="digital-key">
          <DigitalRoomKey
            code={booking.code}
            guestName={booking.guestName}
            hotelName={hotel?.name ?? booking.hotelName ?? "Aurelia Hotel"}
            roomName={booking.roomName ?? booking.roomType?.name ?? "Room"}
            roomNumber={booking.roomNumber}
            validFrom={booking.checkIn}
            validUntil={booking.checkOut}
          />
        </div>
        <div id="loyalty">
          <LoyaltyBadge guestEmail={booking.guestEmail} />
        </div>
      </div>

      {/* live panels */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section aria-label="Live orders and requests" className="card p-5 sm:p-6">
          <h2 className="font-display text-lg font-semibold">Happening now</h2>
          {activeOrders.length === 0 && openRequests.length === 0 && (
            <p className="mt-3 text-sm" style={{ color: "var(--muted)" }}>
              No live orders or requests. {restaurant ? <>Order from {restaurant.name} anytime.</> : "Dining isn't configured at this hotel."}
            </p>
          )}
          <ul className="mt-3 space-y-3">
            {activeOrders.map((o) => (
              <li key={o.id} className="flex items-center justify-between rounded-xl border border-line px-4 py-3 text-sm">
                <span><strong>{o.code}</strong> · {o.deliveryLocation}</span>
                <span className="rounded-full px-2.5 py-1 text-xs font-semibold" style={{ background: "color-mix(in srgb, var(--accent) 10%, transparent)", color: "var(--accent)" }}>
                  {o.status.replace("_", " ").toLowerCase()}
                </span>
              </li>
            ))}
            {openRequests.map((r) => (
              <li key={r.id} className="flex items-center justify-between rounded-xl border border-line px-4 py-3 text-sm">
                <span>{r.title}{r.detail ? ` · ${r.detail}` : ""}</span>
                <span className="rounded-full bg-raised px-2.5 py-1 text-xs font-semibold">{r.status.replace("_", " ").toLowerCase()}</span>
              </li>
            ))}
          </ul>
        </section>

        <section aria-label="Folio so far" className="card p-5 sm:p-6">
          <h2 className="font-display text-lg font-semibold">Folio so far</h2>
          {!hotel && (
            <p className="mt-3 text-sm" style={{ color: "var(--muted)" }}>
              Wallet opens once the property is configured in Aurelia.
            </p>
          )}
          {hotel && (
            <>
              <ul className="mt-3 space-y-2 text-sm">
                {bill.sections.map((s) => (
                  <li key={s.category} className="flex justify-between">
                    <span style={{ color: "var(--muted)" }}>{s.title}</span>
                    <span>{formatINR(s.subtotalInr)}</span>
                  </li>
                ))}
                <li className="flex justify-between border-t border-line pt-2 font-semibold">
                  <span>Total incl. taxes</span>
                  <span>{formatINR(bill.grandTotalInr)}</span>
                </li>
              </ul>
              <Link href={`/trips/${booking.code}/stay/wallet`} className="btn-secondary mt-4 inline-block">Open Aurelia Wallet →</Link>
            </>
          )}
        </section>

        <section id="concierge" aria-label="AI concierge" className="card p-5 sm:p-6 lg:col-span-2">
          <h2 className="font-display text-lg font-semibold">Aurelia Concierge</h2>
          <p className="mb-4 mt-0.5 text-xs" style={{ color: "var(--muted)" }}>
            Understands your stay. Recommends only what {hotel?.name ?? "the hotel"} actually serves.
          </p>
          <StayConcierge bookingCode={booking.code} hotelName={hotel?.name ?? booking.hotelName ?? "your hotel"} />
        </section>

        {/* journey links preserved */}
        <section aria-label="Guest journey" className="card p-5 sm:p-6 lg:col-span-2">
          <h2 className="font-display text-lg font-semibold">Journey shortcuts</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link href={`/trips/${booking.code}/check-in`} className="btn-secondary !py-2 !text-xs">Pre-arrival & check-in</Link>
            <Link href={`/trips/${booking.code}/in-stay`} className="btn-secondary !py-2 !text-xs">In-stay hub</Link>
            <Link href={`/trips/${booking.code}/checkout`} className="btn-secondary !py-2 !text-xs">Checkout & folio</Link>
            {booking.status === "CHECKED_OUT" && (
              <Link href={`/trips/${booking.code}/feedback`} className="btn-secondary !py-2 !text-xs">
                {booking.review ? "View feedback" : "Share feedback"}
              </Link>
            )}
            <Link href={`/confirmation/${booking.code}`} className="btn-secondary !py-2 !text-xs">E-voucher & invoice</Link>
          </div>
        </section>
      </div>
    </div>
  );
}

function TwinTile({
  href,
  emoji,
  title,
  subtitle,
  note,
}: {
  href: string;
  emoji: string;
  title: string;
  subtitle: string;
  note: string;
}) {
  return (
    <Link
      href={href}
      className="group rounded-2xl border border-line p-4 transition-all hover:border-accent hover:bg-raised focus-visible:outline-accent focus-visible:outline-2"
    >
      <span aria-hidden className="text-2xl">{emoji}</span>
      <p className="mt-2 text-xs font-bold tracking-widest">{title}</p>
      <p className="truncate text-sm font-medium" style={{ color: "var(--muted)" }}>{subtitle}</p>
      <p className="mt-1 truncate text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--accent)" }}>{note}</p>
    </Link>
  );
}
