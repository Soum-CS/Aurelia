import Link from "next/link";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { parseStringArray } from "@/lib/data";
import { getUsdToInrRate, toINR } from "@/lib/currency";
import { RoomTools, type RoomSpec } from "@/components/stay/room-tools";

export const metadata: Metadata = { title: "3D room experiences" };
export const dynamic = "force-dynamic";

/**
 * Index of every 3D-enabled room twin — the "TRY 3D EXPERIENCE" entry point.
 * Includes room comparison and the AI room recommendation (spec §21–22).
 */
export default async function RoomsIndexPage() {
  const [rooms, rateInfo] = await Promise.all([
    db.roomType.findMany({
      include: { hotel: true },
      orderBy: [{ hotel: { name: "asc" } }, { basePrice: "asc" }],
      take: 24,
    }),
    getUsdToInrRate(),
  ]);

  const specs: RoomSpec[] = rooms.map((r) => ({
    id: r.id,
    name: r.name,
    hotelName: r.hotel.name,
    city: r.hotel.city,
    priceInr: toINR(r.basePrice, rateInfo).convertedAmount,
    sizeSqm: r.sizeSqm,
    capacity: r.capacity,
    bedType: r.bedType,
    view: r.view,
    amenities: parseStringArray(r.amenities),
  }));

  return (
    <div className="container-x pt-10 pb-4">
      <p className="eyebrow">Immersive 3D</p>
      <h1 className="font-display mt-2 max-w-2xl text-3xl font-semibold sm:text-4xl">
        Step inside a room before you book it
      </h1>
      <p className="mt-3 max-w-xl text-sm leading-relaxed" style={{ color: "var(--muted)" }}>
        Every twin below is an interactive photorealistic 3D room experience — explore
        with cinematic camera presets, inspect PBR materials and ambient lighting,
        switch day/golden/night moods, or walk through at eye height.
      </p>

      <div className="mt-8">
        <RoomTools rooms={specs} />
      </div>

      <p className="mt-8 text-xs" style={{ color: "var(--muted)" }}>
        Looking for live inventory instead?{" "}
        <Link href="/" className="underline">Search hotels</Link> for real availability and ₹ pricing.
      </p>
    </div>
  );
}
