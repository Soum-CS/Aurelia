import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { FoodBrowser } from "@/components/stay/food-browser";

interface PageProps {
  params: Promise<{ code: string }>;
}

export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  return { title: "Hotel Food & Dining · My Stay" };
}

export default async function FoodPage({ params }: PageProps) {
  const { code } = await params;
  const booking = await db.booking.findUnique({
    where: { code: decodeURIComponent(code) },
    include: { roomType: { include: { hotel: true } } },
  });
  if (!booking) notFound();

  return (
    <div className="container-x pt-8 pb-4">
      <nav aria-label="Breadcrumb" className="mb-6 text-sm" style={{ color: "var(--muted)" }}>
        <Link href={`/trips/${booking.code}`} className="hover:text-accent transition-colors">My Aurelia Stay</Link>
        <span aria-hidden className="mx-2">/</span>
        <span style={{ color: "var(--ink)" }}>Food & dining</span>
      </nav>
      <header className="mb-6">
        <p className="eyebrow">Hotel food & dining</p>
        <h1 className="font-display mt-2 text-3xl font-semibold sm:text-4xl">
          Order in, from your own hotel
        </h1>
        <p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>
          Room delivery or schedule ahead — charged to your stay, tracked live.
        </p>
      </header>
      <FoodBrowser bookingCode={booking.code} />
    </div>
  );
}
