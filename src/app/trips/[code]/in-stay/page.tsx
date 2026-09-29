import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { getBookingByCode } from "@/lib/data";
import { formatDate } from "@/lib/format";
import { getUsdToInrRate, usdMoneyText } from "@/lib/currency";
import { localRecsIntro } from "@/lib/constants";
import { SmartControls } from "@/components/smart-controls";
import {
  HousekeepingButtons,
  IssueReportForm,
  RoomServiceOrderer,
} from "@/components/in-stay-panels";
import { ConciergeChat } from "@/components/concierge-chat";

interface PageProps {
  params: Promise<{ code: string }>;
}

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return { title: "In-stay hub" };
}

function Panel({
  title,
  subtitle,
  children,
  className = "",
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`card p-5 sm:p-6 ${className}`}>
      <h2 className="font-display text-lg font-semibold">{title}</h2>
      {subtitle && (
        <p className="mt-0.5 mb-4 text-xs" style={{ color: "var(--muted)" }}>
          {subtitle}
        </p>
      )}
      {!subtitle && <div className="mb-4" />}
      {children}
    </section>
  );
}

export default async function InStayPage({ params }: PageProps) {
  const inr = await getUsdToInrRate();
  const { code } = await params;
  const booking = await getBookingByCode(decodeURIComponent(code));
  if (!booking) notFound();

  if (booking.status === "CONFIRMED") redirect(`/trips/${booking.code}/check-in`);
  if (booking.status !== "CHECKED_IN") redirect(`/trips/${booking.code}/checkout`);

  const hotel = booking.roomType.hotel;
  const recs = localRecsIntro(new Date().getHours());
  const folioExtras = booking.serviceRequests.reduce((s, r) => s + r.price, 0);

  return (
    <div className="container-x pt-8 pb-4">
      <nav aria-label="Breadcrumb" className="mb-6 text-sm" style={{ color: "var(--muted)" }}>
        <Link href="/trips" className="hover:text-accent transition-colors">My trips</Link>
        <span aria-hidden className="mx-2">/</span>
        <span style={{ color: "var(--ink)" }}>In-stay · Room {booking.roomNumber}</span>
      </nav>

      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">
            In-stay hub · {hotel.name}
          </p>
          <h1 className="font-display mt-2 text-3xl font-semibold sm:text-4xl">
            Room {booking.roomNumber}, your command deck
          </h1>
          <p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>
            Until {formatDate(booking.checkOut)} · folio so far{" "}
            {usdMoneyText(folioExtras, inr)} in extras
          </p>
        </div>
        <Link href={`/trips/${booking.code}/checkout`} className="btn-secondary">
          Prepare checkout →
        </Link>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Panel title="Smart room controls" subtitle="Simulated — flip them and imagine the curtains obeying">
          <SmartControls />
        </Panel>

        <Panel title="Room service" subtitle="Charged to your room, delivered to the door">
          <RoomServiceOrderer rateInfo={inr} bookingCode={booking.code} />
        </Panel>

        <Panel title="Housekeeping" subtitle="One tap, fresh everything">
          <HousekeepingButtons bookingCode={booking.code} />
        </Panel>

        <Panel title="Report an issue" subtitle="Photo optional — urgency routes it to the right team">
          <IssueReportForm bookingCode={booking.code} />
        </Panel>

        <Panel
          title={`${recs.title}`}
          subtitle={recs.blurb}
          className="lg:row-span-1"
        >
          <ul className="space-y-2.5 text-sm leading-relaxed">
            {hotel.localTips.map((tip: string) => (
              <li key={tip} className="flex gap-2.5">
                <span aria-hidden style={{ color: "var(--accent)" }}>◆</span>
                {tip}
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs" style={{ color: "var(--muted)" }}>
            ☀️ Outside now: {hotel.weather.tempC}°C · {hotel.weather.condition}
          </p>
        </Panel>

        <Panel
          title="AI concierge"
          subtitle={`Twin of ${hotel.name}'s front desk — escalates to a human when needed`}
          className="lg:col-span-2"
        >
          <ConciergeChat bookingCode={booking.code} hotelName={hotel.name} />
        </Panel>
      </div>

      {/* recent requests */}
      {booking.serviceRequests.length > 0 && (
        <section aria-label="Recent requests" className="card mt-6 p-5 sm:p-6">
          <h2 className="font-display text-lg font-semibold">Recent requests</h2>
          <ul className="mt-3 divide-y divide-line">
            {booking.serviceRequests.slice(0, 6).map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                <span>
                  <strong>{r.title}</strong>
                  {r.detail && (
                    <span style={{ color: "var(--muted)" }}> — {r.detail}</span>
                  )}
                </span>
                <span className="flex items-center gap-2 text-xs" style={{ color: "var(--muted)" }}>
                  {r.price > 0 && <span>{usdMoneyText(r.price, inr)}</span>}
                  {r.priority === "URGENT" && (
                    <span
                      className="rounded-full px-2 py-0.5 font-semibold"
                      style={{ background: "#b03a2e22", color: "#b03a2e" }}
                    >
                      Urgent
                    </span>
                  )}
                  <span
                    className="rounded-full px-2 py-0.5"
                    style={{
                      background:
                        r.status === "RESOLVED"
                          ? "color-mix(in srgb, var(--pine) 13%, transparent)"
                          : "var(--line)",
                    }}
                  >
                    {r.status === "RESOLVED" ? "Done" : "In progress"}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
