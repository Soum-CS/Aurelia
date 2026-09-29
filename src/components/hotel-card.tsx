import Link from "next/link";
import { HotelSummary } from "@/lib/data";
import { formatDistance } from "@/lib/format";
import { getUsdToInrRate, usdMoneyText } from "@/lib/currency";
import { HotelArt } from "./hotel-art";
import { StarIcon } from "./star-icon";
import { WishlistButton } from "./wishlist-button";

export async function HotelCard({
  hotel,
  wishlisted = false,
}: {
  hotel: HotelSummary;
  wishlisted?: boolean;
}) {
  const inr = await getUsdToInrRate();
  return (
    <div className="card group relative overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_24px_48px_-20px_rgb(var(--shadow-color)/0.35)]">
      <Link
        href={`/hotels/${hotel.slug}`}
        className="focus-visible:outline-accent block focus-visible:outline-2 focus-visible:-outline-offset-2"
      >
        <div className="relative aspect-[16/10] overflow-hidden">
          <HotelArt
            seed={hotel.artSeed}
            className="h-full w-full transition-transform duration-500 group-hover:scale-[1.04]"
          />
          {hotel.featured && (
            <span className="absolute top-4 left-4 rounded-full bg-black/45 px-3 py-1 text-[11px] font-semibold tracking-[0.14em] text-white uppercase backdrop-blur-sm">
              Featured
            </span>
          )}
        </div>
        <div className="p-5">
          <div className="flex items-start justify-between gap-3 pr-9">
            <div>
              <p className="eyebrow mb-1">
                {hotel.city}, {hotel.country}
                {hotel.distanceKm !== undefined && (
                  <span aria-hidden> · </span>
                )}
                {hotel.distanceKm !== undefined && (
                  <span style={{ color: "var(--pine)" }}>{formatDistance(hotel.distanceKm)}</span>
                )}
              </p>
              <h3 className="font-display text-xl leading-snug font-semibold">{hotel.name}</h3>
            </div>
            <span className="mt-1 flex shrink-0 items-center gap-1 rounded-full border border-line px-2.5 py-1 text-xs font-semibold">
              <StarIcon className="text-gold h-3.5 w-3.5" />
              {hotel.rating.toFixed(1)}
            </span>
          </div>
          <p className="mt-2 line-clamp-2 pr-2 text-sm" style={{ color: "var(--muted)" }}>
            {hotel.tagline}
          </p>
          <div className="mt-4 flex items-baseline justify-between border-t border-line pt-4">
            <span className="text-xs" style={{ color: "var(--muted)" }}>
              {hotel.roomCount} room types · {hotel.reviewCount} reviews
            </span>
            <span className="text-sm">
              From{" "}
              <strong className="font-display text-lg">{usdMoneyText(hotel.priceFrom, inr)}</strong>{" "}
              /night
            </span>
          </div>
        </div>
      </Link>
      <WishlistButton hotelId={hotel.id} initialSaved={wishlisted} />
    </div>
  );
}
