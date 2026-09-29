import Link from "next/link";
import type { Metadata } from "next";
import { getUserToken, findUserByToken } from "@/lib/user";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { StayConcierge } from "@/components/stay/stay-concierge";

export const metadata: Metadata = { title: "Aurelia Concierge · Stay-Aware Assistant" };
export const dynamic = "force-dynamic";

interface PageProps {
  searchParams?: Promise<{ code?: string }>;
}

export default async function ConciergePage({ searchParams }: PageProps) {
  const sp = searchParams ? await searchParams : {};
  const queryCode = typeof sp?.code === "string" ? sp.code.trim() : null;

  const token = await getUserToken();
  const user = await findUserByToken(token);

  // Fetch active confirmed or checked-in stays
  const userStays = user
    ? await db.booking.findMany({
        where: { userId: user.id, status: { in: ["CONFIRMED", "CHECKED_IN"] } },
        include: { roomType: { include: { hotel: true } } },
        orderBy: { checkIn: "asc" },
        take: 6,
      })
    : [];

  // Determine active booking to display
  let activeStay = null;
  if (queryCode) {
    activeStay = await db.booking.findUnique({
      where: { code: queryCode },
      include: { roomType: { include: { hotel: true } } },
    });
  } else if (userStays.length > 0) {
    activeStay = userStays[0];
  }

  const hotelName = activeStay?.roomType?.hotel.name ?? activeStay?.hotelName ?? "Your Hotel";
  const roomNumber = activeStay?.roomNumber ? `Room ${activeStay.roomNumber}` : (activeStay?.roomName ?? activeStay?.roomType?.name ?? "Guest Suite");

  return (
    <div className="container-x pt-10 pb-8">
      {/* ── Active Stay View ── */}
      {activeStay ? (
        <div className="space-y-6">
          <nav aria-label="Breadcrumb" className="text-sm" style={{ color: "var(--muted)" }}>
            <Link href="/trips" className="hover:text-accent transition-colors">My trips</Link>
            <span aria-hidden className="mx-2">/</span>
            <Link href={`/trips/${activeStay.code}`} className="hover:text-accent transition-colors">
              {activeStay.code}
            </Link>
            <span aria-hidden className="mx-2">/</span>
            <span style={{ color: "var(--ink)" }}>Concierge</span>
          </nav>

          <header className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                <p className="eyebrow !tracking-widest">Aurelia Concierge · Live Stay</p>
              </div>
              <h1 className="font-display mt-2 text-3xl font-semibold sm:text-4xl">
                {hotelName}
              </h1>
              <p className="mt-1.5 text-sm" style={{ color: "var(--muted)" }}>
                {roomNumber} · Depart {formatDate(activeStay.checkOut)} · Booking {activeStay.code}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href={`/trips/${activeStay.code}/in-stay`} className="btn-secondary !px-4 !py-2 !text-xs">
                In-Stay Hub →
              </Link>
              <Link href={`/trips/${activeStay.code}/stay/wallet`} className="btn-secondary !px-4 !py-2 !text-xs">
                Room Folio →
              </Link>
            </div>
          </header>

          {/* Stay switcher if user has more than 1 stay */}
          {userStays.length > 1 && (
            <div className="flex flex-wrap items-center gap-2 border-b border-line pb-3 text-xs">
              <span className="font-semibold text-muted">Switch stay:</span>
              {userStays.map((s) => {
                const sName = s.roomType?.hotel.name ?? s.hotelName ?? s.code;
                const isSelected = s.code === activeStay.code;
                return (
                  <Link
                    key={s.id}
                    href={`/concierge?code=${s.code}`}
                    className={`rounded-full px-3 py-1 font-medium transition-colors ${
                      isSelected
                        ? "bg-accent text-on-accent"
                        : "border border-line bg-raised hover:border-accent text-ink"
                    }`}
                  >
                    {sName} ({s.code})
                  </Link>
                );
              })}
            </div>
          )}

          {/* Embedded Full Stay Concierge */}
          <div className="card p-5 sm:p-6">
            <StayConcierge
              bookingCode={activeStay.code}
              hotelName={hotelName}
              initialRoomNumber={activeStay.roomNumber ?? undefined}
            />
          </div>

          {/* Fast Navigation Shortcuts */}
          <div className="grid gap-3 sm:grid-cols-4">
            <Link
              href={`/trips/${activeStay.code}/stay/food`}
              className="card p-4 transition-all hover:border-accent"
            >
              <p className="text-xs font-bold">🍛 Kitchen Dining</p>
              <p className="mt-1 text-xs" style={{ color: "var(--muted)" }}>
                Order directly from {hotelName}&apos;s kitchen
              </p>
            </Link>
            <Link
              href={`/trips/${activeStay.code}/stay/services`}
              className="card p-4 transition-all hover:border-accent"
            >
              <p className="text-xs font-bold">🧺 Room Services</p>
              <p className="mt-1 text-xs" style={{ color: "var(--muted)" }}>
                Towels, extra pillows & housekeeping
              </p>
            </Link>
            <Link
              href={`/trips/${activeStay.code}/stay/wallet`}
              className="card p-4 transition-all hover:border-accent"
            >
              <p className="text-xs font-bold">💳 Live Room Folio</p>
              <p className="mt-1 text-xs" style={{ color: "var(--muted)" }}>
                Unified billing, charges & payment status
              </p>
            </Link>
            <Link
              href={`/trips/${activeStay.code}#digital-key`}
              className="card p-4 transition-all hover:border-accent"
            >
              <p className="text-xs font-bold">🔑 Digital Room Key</p>
              <p className="mt-1 text-xs" style={{ color: "var(--muted)" }}>
                NFC contactless unlock & room controls
              </p>
            </Link>
          </div>
        </div>
      ) : (
        /* ── Refined Empty State ── */
        <div>
          <p className="eyebrow">Aurelia Concierge · Stay-Aware Assistant</p>
          <h1 className="font-display mt-2 max-w-2xl text-3xl font-semibold sm:text-4xl">
            A hotel companion that knows your stay — because it&apos;s built on it
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-relaxed" style={{ color: "var(--muted)" }}>
            The concierge works on your real booking: it recommends only dishes your hotel&apos;s kitchen
            actually serves, sends requests to their team, and answers from your live folio. It never
            claims an order was placed until the backend confirms one.
          </p>

          <div className="mt-8 grid gap-3 sm:max-w-3xl sm:grid-cols-2">
            {[
              ["🍛 Food, your way", "“I'm hungry. Something spicy under ₹700.”"],
              ["🧺 Services", "“Send two towels to my room.”"],
              ["🌅 Evenings planned", "“What can I do near the hotel tonight?”"],
              ["💳 Money questions", "“How much have I spent during my stay?”"],
            ].map(([t, q]) => (
              <div key={t} className="card p-5">
                <p className="text-sm font-bold">{t}</p>
                <p className="mt-1 text-xs italic" style={{ color: "var(--muted)" }}>{q}</p>
              </div>
            ))}
          </div>

          <div className="card mt-10 max-w-3xl p-6 sm:p-8">
            <h2 className="font-display text-xl font-semibold">Your stay, your concierge</h2>
            <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--muted)" }}>
              Your Aurelia Concierge activates the moment you have a confirmed or checked-in booking.
              It connects directly with your hotel&apos;s front desk, kitchen menu, and live room folio — ensuring
              zero hallucinations and authentic luxury service.
            </p>

            <div className="mt-6 flex flex-wrap items-center gap-4">
              <Link href="/" className="btn-primary !px-6 !py-3">
                Find a Hotel →
              </Link>
              <Link href="/trips" className="btn-secondary !px-5 !py-3">
                View My Trips
              </Link>
            </div>

            <div className="mt-6 border-t border-line pt-5">
              <p className="text-xs font-semibold" style={{ color: "var(--muted)" }}>
                Already have a reservation? Enter your booking code:
              </p>
              <form action="/concierge" method="GET" className="mt-2 flex max-w-md gap-2">
                <input
                  name="code"
                  placeholder="e.g. AUR-H8YE-3DNJ"
                  className="input flex-1 !text-xs uppercase"
                  required
                />
                <button type="submit" className="btn-secondary !px-4 !py-2 !text-xs">
                  Open Concierge →
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

