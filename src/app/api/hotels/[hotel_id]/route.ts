import { NextResponse } from "next/server";
import { getDatasetHotel, datasetProvider } from "@/lib/hotels/csv-provider";
import { DatasetUnavailableError } from "@/lib/hotels/csv-loader";

export const dynamic = "force-dynamic";

/** GET /api/hotels/HTL001 — a single dataset hotel by hotel_id. */
export async function GET(_req: Request, ctx: { params: Promise<{ hotel_id: string }> }) {
  try {
    const { hotel_id } = await ctx.params;
    const hotel = await getDatasetHotel(hotel_id);
    if (!hotel) {
      return NextResponse.json({ success: false, error: "Hotel not found." }, { status: 404 });
    }
    const offers = await datasetProvider.getRooms({ hotelId: hotel_id, checkIn: "", checkOut: "", adults: 1 });
    return NextResponse.json({ success: true, source: "csv", hotel, rooms: offers });
  } catch (e) {
    if (e instanceof DatasetUnavailableError) {
      return NextResponse.json({ success: false, error: "DATASET_UNAVAILABLE", message: e.message }, { status: 503 });
    }
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
