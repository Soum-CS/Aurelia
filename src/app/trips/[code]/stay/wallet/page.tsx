import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { WalletBill } from "@/components/stay/wallet-bill";

interface PageProps {
  params: Promise<{ code: string }>;
}

export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  return { title: "Aurelia Wallet & unified bill" };
}

export default async function WalletPage({ params }: PageProps) {
  const { code } = await params;
  const booking = await db.booking.findUnique({
    where: { code: decodeURIComponent(code) },
    select: { code: true },
  });
  if (!booking) notFound();

  return (
    <div className="container-x pt-8 pb-4">
      <nav aria-label="Breadcrumb" className="mb-6 text-sm" style={{ color: "var(--muted)" }}>
        <Link href={`/trips/${booking.code}`} className="hover:text-accent transition-colors">My Aurelia Stay</Link>
        <span aria-hidden className="mx-2">/</span>
        <span style={{ color: "var(--ink)" }}>Wallet & unified bill</span>
      </nav>
      <header className="mb-6">
        <p className="eyebrow">Smart stay wallet</p>
        <h1 className="font-display mt-2 text-3xl font-semibold sm:text-4xl">One wallet. One bill.</h1>
        <p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>
          Room, food, services and experiences — tracked live, settled once, invoiced together.
        </p>
      </header>
      <WalletBill bookingCode={booking.code} />
    </div>
  );
}
