import Link from "next/link";
import { getDatasetHotel } from "@/lib/hotels/csv-provider";
import { DatasetCheckout } from "@/components/dataset-checkout";
import { LiveConnectionRequired } from "@/components/live-connection-required";

interface PageProps {
  params: Promise<{ hotelId: string }>;
  searchParams: Promise<{ checkIn?: string; checkOut?: string; rooms?: string; guests?: string }>;
}

export default async function BookDatasetPage({ params, searchParams }: PageProps) {
  const { hotelId } = await params;
  const sp = await searchParams;

  let hotel;
  try {
    hotel = await getDatasetHotel(hotelId);
  } catch {
    hotel = null;
  }
  if (!hotel) {
    return (
      <div className="container-x pt-10 pb-4"><LiveConnectionRequired /></div>
    );
  }

  // deterministic defaults derived from the request, not the render clock
  const base = new Date(`${sp.checkIn ?? "2026-09-01"}T00:00:00Z`).getTime() || 0;
  const defaultIn = sp.checkIn ?? new Date(base + 7 * 86_400_000).toISOString().slice(0, 10);
  const defaultOut = sp.checkOut ?? new Date(base + 10 * 86_400_000).toISOString().slice(0, 10);

  return (
    <div className="container-x pt-8 pb-4">
      <nav aria-label="Breadcrumb" className="mb-5 text-sm" style={{ color: "var(--muted)" }}>
        <Link href="/" className="hover:text-accent transition-colors">Stays</Link>
        <span aria-hidden className="mx-2">/</span>
        <Link href={`/hotels/${hotel.hotel_id}`} className="hover:text-accent transition-colors">{hotel.name}</Link>
        <span aria-hidden className="mx-2">/</span>
        <span style={{ color: "var(--ink)" }}>Secure checkout</span>
      </nav>
      <p className="eyebrow mb-1">🔒 Secure Checkout</p>
      <h1 className="font-display mb-6 text-3xl font-semibold">Complete your stay</h1>
      <DatasetCheckout
        hotelId={hotel.hotel_id}
        hotelName={hotel.name}
        cityState={`${hotel.city}, ${hotel.state}`}
        roomType={hotel.room_type}
        roomsAvailable={hotel.rooms_available}
        pricePerNightInr={hotel.price_per_night_inr}
        initialCheckIn={defaultIn}
        initialCheckOut={defaultOut}
      />
    </div>
  );
}
