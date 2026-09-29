import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { resolveHotelForBooking } from "@/lib/stay";
import { DigitalStayPass } from "@/components/stay/stay-pass";

interface PageProps {
  params: Promise<{ code: string }>;
}

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return { title: "Digital Stay Pass · Aurelia" };
}

export default async function StayPassPage({ params }: PageProps) {
  const { code } = await params;
  const decoded = decodeURIComponent(code);

  const booking = await db.booking.findUnique({
    where: { code: decoded },
    include: {
      roomType: { include: { hotel: true } },
    },
  });

  if (!booking) notFound();

  const hotel = await resolveHotelForBooking(booking);

  return (
    <div className="container-x py-10">
      <div className="mb-6 flex items-center justify-between">
        <Link
          href={`/trips/${booking.code}`}
          className="text-xs font-semibold text-muted hover:text-ink inline-flex items-center gap-1.5 transition-colors"
        >
          ← Back to My Stay
        </Link>
        <span className="text-[11px] uppercase tracking-wider font-semibold text-accent">
          Verified Guest Access Pass
        </span>
      </div>

      <DigitalStayPass
        code={booking.code}
        guestName={booking.guestName}
        hotelName={hotel?.name ?? booking.hotelName ?? "Aurelia Hotel"}
        roomName={booking.roomName ?? booking.roomType?.name ?? "Luxury Suite"}
        roomNumber={booking.roomNumber}
        checkIn={booking.checkIn}
        checkOut={booking.checkOut}
        guests={booking.guests}
        hotelAddress={hotel?.address ?? booking.destinationLabel ?? "Hotel Reception"}
        hotelLat={hotel?.latitude}
        hotelLng={hotel?.longitude}
      />
    </div>
  );
}
