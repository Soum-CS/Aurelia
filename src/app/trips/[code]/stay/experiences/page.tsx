import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { ExperiencesPanel } from "@/components/stay/experiences-panel";

interface PageProps {
  params: Promise<{ code: string }>;
}

export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  return { title: "Explore nearby · My Stay" };
}

export default async function ExperiencesPage({ params }: PageProps) {
  const { code } = await params;
  const booking = await db.booking.findUnique({
    where: { code: decodeURIComponent(code) },
    select: { code: true, checkIn: true, checkOut: true },
  });
  if (!booking) notFound();

  return (
    <div className="container-x pt-8 pb-4">
      <nav aria-label="Breadcrumb" className="mb-6 text-sm" style={{ color: "var(--muted)" }}>
        <Link href={`/trips/${booking.code}`} className="hover:text-accent transition-colors">My Aurelia Stay</Link>
        <span aria-hidden className="mx-2">/</span>
        <span style={{ color: "var(--ink)" }}>Experiences & itinerary</span>
      </nav>
      <header className="mb-6">
        <p className="eyebrow">Local experiences</p>
        <h1 className="font-display mt-2 text-3xl font-semibold sm:text-4xl">Explore nearby</h1>
        <p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>
          Curated around your hotel — add to your stay and let the AI planner shape the days.
        </p>
      </header>
      <ExperiencesPanel
        bookingCode={booking.code}
        checkInISO={new Date(booking.checkIn).toISOString()}
        checkOutISO={new Date(booking.checkOut).toISOString()}
      />
    </div>
  );
}
