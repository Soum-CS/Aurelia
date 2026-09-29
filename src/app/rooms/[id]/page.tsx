import { getProvider } from "@/lib/hotel-provider";
import { LiveConnectionRequired } from "@/components/live-connection-required";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getRoomTypeById } from "@/lib/data";
import { getUsdToInrRate, usdMoneyText } from "@/lib/currency";
import { AmenityIcon } from "@/components/amenity-icon";
import { StarIcon } from "@/components/star-icon";
import { Reveal } from "@/components/reveal";
import { ExplorerLazy } from "@/components/room3d/explorer-lazy";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const room = await getRoomTypeById(id);
  return { title: room ? `${room.name} · 3D explorer` : "Room" };
}

export default async function RoomExplorerPage({ params }: PageProps) {
  // Aurelia has no demo rooms/bookings: this surface requires live inventory.
  if (!getProvider()) {
    return (
      <div className="container-x pt-10 pb-4">
        <LiveConnectionRequired />
      </div>
    );
  }
  const inr = await getUsdToInrRate();
  const { id } = await params;
  const room = await getRoomTypeById(id);
  if (!room) notFound();

  return (
    <div className="container-x pt-8 pb-4">
      <nav aria-label="Breadcrumb" className="mb-5 text-sm" style={{ color: "var(--muted)" }}>
        <Link href="/" className="hover:text-accent transition-colors">
          Stays
        </Link>
        <span aria-hidden className="mx-2">
          /
        </span>
        <Link href={`/hotels/${room.hotel.slug}`} className="hover:text-accent transition-colors">
          {room.hotel.name}
        </Link>
        <span aria-hidden className="mx-2">
          /
        </span>
        <span style={{ color: "var(--ink)" }}>{room.name}</span>
      </nav>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1.65fr_1fr]">
        <div className="animate-fade-up">
          <p className="eyebrow mb-2">3D room explorer</p>
          <h1 className="font-display mb-5 text-3xl font-semibold sm:text-4xl">
            {room.name}
          </h1>
          <ExplorerLazy
            sceneJson={room.scene}
            meta={{
              roomName: room.name,
              hotelName: room.hotel.name,
              bedType: room.bedType,
              viewLabel: room.view,
              capacity: room.capacity,
              sizeSqm: room.sizeSqm,
              artSeed: room.hotel.artSeed,
            }}
          />
          <p className="mt-3 text-xs leading-relaxed" style={{ color: "var(--muted)" }}>
            <strong style={{ color: "var(--ink)" }}>Photorealistic concept twin</strong> — an
            illustrative Aurelia 3D rendering of this room category, generated with physically-based
            materials, HDRI lighting, and real-time reflections.
            Explore with cinematic camera presets (hero, bed, bathroom, window, workspace),
            walk through at eye height (drag to look, WASD / arrow keys to move), tap markers to
            inspect features, switch lighting moods (day, golden hour, night), and choose your
            graphics quality. Official 360° tours, panoramas or 3D models supplied by a connected
            hotel provider would be shown here instead, labeled as such.
          </p>
        </div>

        <Reveal delay={120}>
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <div className="card p-6">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-display text-xl font-semibold">{room.hotel.name}</h2>
              <span className="flex shrink-0 items-center gap-1 rounded-full border border-line px-2.5 py-1 text-xs font-semibold">
                <StarIcon className="text-gold h-3.5 w-3.5" />
                {room.hotel.rating.toFixed(1)}
              </span>
            </div>
            <p className="mt-0.5 text-xs" style={{ color: "var(--muted)" }}>
              {room.hotel.city}, {room.hotel.country}
            </p>

            <ul
              className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 border-y border-line py-4 text-xs"
              style={{ color: "var(--muted)" }}
            >
              <li>{room.sizeSqm} m²</li>
              <li>Sleeps {room.capacity}</li>
              <li>{room.bedType}</li>
              <li>{room.view}</li>
            </ul>

            <ul className="mt-4 space-y-2">
              {room.amenities.slice(0, 5).map((a) => (
                <li key={a} className="flex items-center gap-2.5 text-sm">
                  <AmenityIcon name={a} className="text-accent h-4 w-4 shrink-0" />
                  {a}
                </li>
              ))}
            </ul>

            <p className="mt-5 text-sm leading-relaxed" style={{ color: "var(--muted)" }}>
              {room.description}
            </p>

            <div className="mt-6 flex items-baseline justify-between border-t border-line pt-5">
              <div>
                <p className="text-xs" style={{ color: "var(--muted)" }}>
                  From
                </p>
                <p className="font-display text-3xl font-semibold">
                  {usdMoneyText(room.basePrice, inr)}
                  <span className="text-sm font-normal" style={{ color: "var(--muted)" }}>
                    {" "}
                    /night
                  </span>
                </p>
              </div>
            </div>
            <Link href={`/book/${room.id}`} className="btn-primary mt-4 w-full">
              Choose dates & book
            </Link>
          </div>
          </aside>
        </Reveal>
      </div>
    </div>
  );
}
