import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { loadStayContext } from "@/lib/stay-api";
import { parseStringArray } from "@/lib/data";
import { parseMenuAddons, ensureRestaurantForStay } from "@/lib/stay";

export const dynamic = "force-dynamic";

/**
 * GET /api/bookings/[code]/food/menu — the booked hotel's own kitchen.
 * Catalog restaurants come from configured data; dataset bookings get a
 * clearly-labeled demo kitchen. A 503 is returned only when no anchor
 * exists at all — never a fabricated menu presented as live inventory.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const ctx = await loadStayContext(decodeURIComponent(code));
  if (!ctx.ok) return ctx.response;

  const restaurant = await ensureRestaurantForStay(ctx.booking, ctx.hotel);
  if (!restaurant) {
    return NextResponse.json(
      {
        error: "RESTAURANT_NOT_CONFIGURED",
        message: `${ctx.booking.hotelName ?? "This hotel"} has not been configured in Aurelia yet, so its kitchen can't take orders here.`,
      },
      { status: 503 },
    );
  }

  const items = await db.menuItem.findMany({
    where: { restaurantId: restaurant.id },
    orderBy: [{ categoryId: "asc" }, { sortOrder: "asc" }],
  });

  return NextResponse.json({
    restaurant: {
      id: restaurant.id,
      name: restaurant.name,
      cuisine: restaurant.cuisine,
      summary: restaurant.summary,
      hours: JSON.parse(restaurant.hours || "{}"),
      provenance: restaurant.dataProvenance,
    },
    hotel: {
      name: ctx.hotel?.name ?? ctx.booking.hotelName ?? "Your hotel",
      city: ctx.hotel?.city ?? "",
    },
    categories: restaurant.categories.map((c) => ({
      id: c.id,
      name: c.name,
    })),
    items: items.map((i) => ({
      id: i.id,
      categoryId: i.categoryId,
      name: i.name,
      description: i.description,
      priceInr: i.priceInr,
      diet: i.diet,
      calories: i.calories,
      allergens: parseStringArray(i.allergens),
      ingredients: i.ingredients,
      prepMinutes: i.prepMinutes,
      spiceLevel: i.spiceLevel,
      proteinG: i.proteinG,
      tags: parseStringArray(i.tags),
      addons: parseMenuAddons(i.addons),
      emoji: i.imageEmoji,
      available: i.available,
    })),
  });
}
